/**
 * 스타일 메모리 챗봇 — OpenAI 키는 여기서만 쓰이고 브라우저로 나가지 않는다.
 *
 * 이 프로젝트는 지금까지 브라우저가 OpenAI 를 직접 불렀다(CLAUDE.md 8-7, 개인 키 방식).
 * 그런데 이 기능은 사용자의 대화를 Supabase 에 쌓아 다음 글 생성에 자동으로 반영하는
 * 개인 메모리라서, 호출을 서버로 옮겨 키를 서버 환경 변수(OPENAI_API_KEY)에만 둔다.
 * (요청자 결정 2026-08-26 — 이 라우트만 신설, 기존 글귀 생성 경로는 그대로 둔다.)
 *
 * Supabase 읽기/쓰기(대화 저장·요약 저장)는 여기서 하지 않는다. 브라우저의 Supabase
 * 클라이언트가 로그인 세션으로 RLS 아래 직접 한다(`lib/copymemory.js`) — 이 라우트는
 * 순수하게 "승인된 사용자인지 확인하고 OpenAI 를 대신 불러 주는" 프록시로만 좁힌다.
 *
 * 요청: POST { mode: 'chat', messages } | { mode: 'summarize', priorSummary, messages }
 *      | { mode: 'revise', instruction, draft, channelId }
 * 응답: { reply } | { summary } | { draft }
 *
 * 'revise' 는 스타일 메모(요약)와 별개다 — 요약은 "다음에 새로 만들 글"에 참고되지만,
 * 챗봇에서 방금 요청한 내용을 **지금 보고 있는 시안**에도 바로 반영해 달라는 요청자 지시
 * (2026-08-26)로 추가했다. 사실·형식은 손대지 않고 요청한 것만 고친다 — 아래 시스템 프롬프트 참고.
 */
import { SUPABASE } from '../../../lib/supabase.js';
import { recordOpenAIUsage } from '../../../lib/openaiusage.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-5.6-terra';
/** 추론 토큰도 출력 요금으로 과금된다 — 정해진 형식 없는 짧은 대화라 낮은 강도로 충분하다. */
const REASONING_EFFORT = 'low';

const MAX_MESSAGE_CHARS = 2000;
const MAX_MESSAGES = 24;
const MAX_SUMMARY_CHARS = 900;
const MAX_DRAFT_CHARS = 6000; // 블로그 채널 상한(4,400자)보다 넉넉히 잡은 안전망

const CHAT_SYSTEM = `당신은 이 사용자의 블로그 글쓰기 스타일과 취향을 함께 정리해 가는 대화 상대입니다.

목적: 사용자가 어떤 어투·문장 길이·즐겨 쓰는 표현·피하고 싶은 표현·좋아하는 도입 방식을
좋아하는지 자연스러운 대화로 알아냅니다. 이 대화는 요약되어 이후 이 사용자의 블로그 글을
AI로 만들 때 참고 자료로 자동으로 들어갑니다.

- 짧고 자연스러운 대화체로 답합니다. 설교하거나 번호 목록을 나열하지 않습니다.
- 사용자가 글쓰기와 무관한 이야기를 해도 편하게 받아 주되, 대화가 이어지면 스타일 이야기로
  슬쩍 돌아옵니다.
- 상품·행사·수치 등 사실 정보를 사용자 대신 새로 지어내거나 단정하지 않습니다. 이 대화는
  문체를 위한 것이지 상품 자료를 만드는 자리가 아닙니다.
- 답변은 3~5문장을 넘기지 않습니다.`;

const SUMMARY_SYSTEM = `방금 나눈 대화와 이전 요약을 합쳐, 이 사용자의 "블로그 글쓰기 스타일 메모"를 다시 씁니다.

- 최대 ${MAX_SUMMARY_CHARS}자 이내, 한국어 불릿(-) 목록.
- 담는 것: 선호하는 말투·어미, 문장 길이와 리듬, 자주 쓰는 표현, 피하고 싶은 표현, 좋아하는
  도입·구성 방식, 톤에 대한 언급.
- 담지 않는 것: 특정 상품·행사·수치 등 사실 정보, 이 대화에 나온 사적인 신상 정보.
- 이전 요약과 내용이 겹치면 하나로 합치고, 상충하면 최신 대화 쪽을 따릅니다.
- 이번 대화에 스타일 신호가 거의 없으면 이전 요약을 거의 그대로 유지합니다.
- 목록 항목이 아닌 다른 말은 덧붙이지 않습니다.`;

const REVISE_CHAT_SYSTEM = `당신은 이미 완성된 SNS·블로그 원고를 사용자의 요청에 맞게 다시 쓰는 편집자입니다.

사용자가 챗봇에게 방금 보낸 메시지가 이 원고에 대한 수정 요청일 수 있습니다. 그 요청을
**정확히, 그것만** 반영해 원고 전체를 다시 씁니다.

■ 반영합니다
- 사용자가 말한 것만 고칩니다 (예: "말투를 부드럽게" → 어미·표현만 바꿉니다. 문단을 새로 짓지 않습니다)
- 그 외 문장·순서·구성은 그대로 둡니다

■ 절대 바꾸지 않습니다
- 숫자·기간·조건·기관명 등 사실 정보 — 지어내거나 지우지 않습니다
- 아래로 시작하는 줄은 글자 하나 다르지 않게, 위치도 그대로 둡니다:
  "[인용구]" 표식 / "## " 로 시작하는 소제목 / "[테이블" 표식과 그 안의 줄 /
  "📷" 로 시작하는 줄 / "⤷" 로 시작하는 줄 / "🔔" 로 시작하는 줄 / "#" 해시태그 줄
- 전체 글자 수를 크게 늘리거나 줄이지 않습니다

■ 요청이 이 원고와 무관하면 (인사말·잡담·질문 등, 수정 지시가 아닌 경우)
원고를 손대지 않고 **입력받은 원고를 토씨 하나 틀리지 않고 그대로** 돌려줍니다.

원고 전체만 출력합니다. 설명·머리말·따옴표를 붙이지 않습니다.`;

function fail(status, message) {
  return Response.json({ error: message }, { status });
}

async function requireApprovedUser(request) {
  if (!SUPABASE.url || !SUPABASE.anonKey) {
    return { ok: false, status: 500, message: 'Supabase 설정이 없습니다.' };
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: SUPABASE.anonKey, Authorization: `Bearer ${token}` };

  let user;
  try {
    const who = await fetch(`${SUPABASE.url}/auth/v1/user`, { headers });
    if (!who.ok) return { ok: false, status: 401, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    user = await who.json();
  } catch {
    return { ok: false, status: 503, message: '로그인 확인 서버에 연결하지 못했습니다.' };
  }
  if (!user?.id) return { ok: false, status: 401, message: '로그인 정보를 확인하지 못했습니다.' };

  let row;
  try {
    const q = await fetch(`${SUPABASE.url}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`, { headers });
    if (!q.ok) return { ok: false, status: 403, message: '승인 상태를 확인하지 못했습니다.' };
    [row] = await q.json();
  } catch {
    return { ok: false, status: 503, message: '승인 상태 확인에 실패했습니다.' };
  }
  if (row?.status !== 'approved') {
    return { ok: false, status: 403, message: '관리자 승인이 완료된 계정만 사용할 수 있습니다.' };
  }
  return { ok: true, user, token };
}

async function saveUsage(auth, type, result) {
  await recordOpenAIUsage({
    supabaseUrl: process.env.SUPABASE_URL || SUPABASE.url,
    anonKey: process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey,
    token: auth.token,
    userId: auth.user.id,
    type,
    model: result.model,
    responseId: result.responseId,
    usage: result.usage,
  });
}

/** 형태·길이를 검사해 프롬프트 예산과 비용을 서버가 못박는다 — 클라이언트 값을 그대로 믿지 않는다. */
function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
}

export async function POST(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.message);

  const key = process.env.OPENAI_API_KEY || '';
  if (!key) return fail(503, '서버에 OPENAI_API_KEY 가 설정되지 않았습니다.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, '요청 본문을 읽을 수 없습니다.');
  }

  if (body?.mode === 'summarize') {
    const priorSummary = typeof body?.priorSummary === 'string' ? body.priorSummary.slice(0, MAX_SUMMARY_CHARS) : '';
    const messages = sanitizeMessages(body?.messages);
    if (!messages.length) return fail(400, '요약할 대화가 없습니다.');

    const transcript = messages.map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`).join('\n');
    const input = [
      priorSummary ? `[이전 요약]\n${priorSummary}` : '[이전 요약 없음]',
      '',
      '[이번 대화]',
      transcript,
    ].join('\n');

    try {
      const summary = await callOpenAI({ key, system: SUMMARY_SYSTEM, input, maxOutputTokens: 700 });
      await saveUsage(auth, 'copy_summary', summary);
      return Response.json({ summary: summary.text.trim().slice(0, MAX_SUMMARY_CHARS) });
    } catch (e) {
      return fail(e.status || 502, e.message || '요약 생성에 실패했습니다.');
    }
  }

  if (body?.mode === 'revise') {
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim().slice(0, MAX_MESSAGE_CHARS) : '';
    const draft = typeof body?.draft === 'string' ? body.draft.trim().slice(0, MAX_DRAFT_CHARS) : '';
    if (!draft) return fail(400, '반영할 원고가 없습니다.');
    if (!instruction) return fail(400, '요청 내용이 없습니다.');

    const input = ['[사용자 요청]', instruction, '', '[원고]', draft, '[원고 끝]'].join('\n');
    try {
      const revised = await callOpenAI({
        key,
        system: REVISE_CHAT_SYSTEM,
        input,
        maxOutputTokens: Math.min(6000, draft.length + 1000),
      });
      await saveUsage(auth, 'copy_revision', revised);
      return Response.json({ draft: revised.text.trim() });
    } catch (e) {
      return fail(e.status || 502, e.message || '원고 반영에 실패했습니다.');
    }
  }

  const messages = sanitizeMessages(body?.messages);
  if (!messages.length) return fail(400, '대화 내용이 없습니다.');

  try {
    const reply = await callOpenAI({ key, system: CHAT_SYSTEM, input: messages, maxOutputTokens: 600 });
    await saveUsage(auth, 'copy_chat', reply);
    return Response.json({ reply: reply.text.trim() });
  } catch (e) {
    return fail(e.status || 502, e.message || '대화 생성에 실패했습니다.');
  }
}

/** 지원하지 않는 파라미터는 빼고 다시 보낸다 (lib/openai.js · api/text.mjs 와 같은 규칙) */
const OPTIONAL = ['reasoning', 'max_output_tokens'];

async function callOpenAI({ key, system, input, maxOutputTokens }) {
  const base = {
    model: MODEL,
    input,
    instructions: system,
    reasoning: { effort: REASONING_EFFORT },
    max_output_tokens: maxOutputTokens,
  };

  let body = base;
  let res = await post(key, body);

  for (let i = 0; i < OPTIONAL.length && !res.ok && res.status === 400; i++) {
    const { message, param } = await errorParts(res);
    const blamed = OPTIONAL.includes(param) ? param : OPTIONAL.find((p) => new RegExp(`\\b${p}\\b`).test(message));
    if (!blamed || !(blamed in body)) break;
    body = { ...body };
    delete body[blamed];
    res = await post(key, body);
  }

  const data = await ensureOk(res);
  const text = data.output_text || findText(data);
  if (!text) {
    if (data.status === 'incomplete') throw withStatus(502, '출력 상한에 걸려 답이 완성되지 않았습니다.');
    throw withStatus(502, '응답에 내용이 없습니다.');
  }
  return {
    text: String(text),
    usage: data.usage,
    model: data.model || MODEL,
    responseId: data.id,
  };
}

const post = (key, body) => fetch(OPENAI_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify(body),
});

const withStatus = (status, message) => Object.assign(new Error(message), { status });

async function errorParts(res) {
  try {
    const j = await res.clone().json();
    return { message: j?.error?.message || '', param: j?.error?.param || '' };
  } catch {
    return { message: '', param: '' };
  }
}

async function ensureOk(res) {
  if (res.ok) return res.json();
  const { message } = await errorParts(res);
  if (res.status === 401) throw withStatus(502, '서버에 설정된 API 키가 올바르지 않습니다. 관리자에게 알려 주세요.');
  if (res.status === 429) throw withStatus(429, '요청이 몰렸거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.');
  throw withStatus(502, `대화 생성에 실패했습니다 (${res.status}). ${message}`);
}

/** output_text 가 없을 때 중첩 구조를 훑는다 (lib/openai.js · api/text.mjs 와 같은 방식) */
function findText(node) {
  if (!node || typeof node !== 'object') return '';
  if ((node.type === 'output_text' || node.type === 'text') && typeof node.text === 'string') return node.text;
  let out = '';
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const v of value) out += findText(v);
    else if (value && typeof value === 'object') out += findText(value);
  }
  return out;
}
