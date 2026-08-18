/**
 * 글귀 생성 프록시 — 키는 여기서만 쓰이고 브라우저로 나가지 않는다
 *
 * 요청: POST { provider, model, prompt, system, temperature, maxOutputTokens }
 * 응답: { text, usage }
 *
 * `usage` 를 그대로 돌려주는 이유: tools/bench.html 이 **실제 토큰 사용량**으로 비용을 잰다.
 * 글자 수로 어림하면 추론 토큰을 놓친다.
 */
import {
  ALLOWED_TEXT_MODELS, DEFAULT_TEXT_MODEL, requirePost, requireApprovedUser,
  readPrompt, pickModel, clampOutputTokens, providerOf, keyFor, fail, json,
} from './_shared.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * 추론 강도. 추론 토큰은 출력 요금으로 과금되므로 서버에서 못박는다.
 * lib/openai.js 와 같은 값을 쓴다 — 한쪽만 바꾸면 로컬과 배포본의 비용이 달라진다.
 */
const REASONING_EFFORT = 'low';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;

  const auth = await requireApprovedUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);

  const body = req.body || {};
  const provider = providerOf(body);

  const key = keyFor(provider);
  if (!key) return fail(res, 503, `서버에 ${provider === 'gemini' ? 'GEMINI' : 'OPENAI'}_API_KEY 가 설정되지 않았습니다.`);

  const prompt = readPrompt(body);
  if (!prompt.ok) return fail(res, 400, prompt.message);

  const model = pickModel(body.model, ALLOWED_TEXT_MODELS, DEFAULT_TEXT_MODEL);
  if (!model.ok) return fail(res, 400, model.message);

  const maxOutputTokens = clampOutputTokens(body.maxOutputTokens);
  const baseSystem = typeof body.system === 'string' ? body.system : '';
  const memory = await preferenceMemory(auth, body.memoryContext);
  const system = memory ? `${baseSystem}\n\n${memory}` : baseSystem;
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : undefined;

  try {
    const out = provider === 'gemini'
      ? await callGemini({ key, model: model.value, prompt: prompt.value, system, temperature, maxOutputTokens })
      : await callOpenAI({ key, model: model.value, prompt: prompt.value, system, temperature, maxOutputTokens });
    return json(res, 200, out);
  } catch (e) {
    // 벤더 오류 메시지에 키가 섞여 나올 일은 없지만, 상태 코드는 그대로 전해 원인을 알 수 있게 한다
    return fail(res, e.status || 502, e.message || '글 생성에 실패했습니다.');
  }
}

/** 최종 복사 선택이 10건 이상일 때만 작고 보수적인 개인화 지침을 만든다. */
async function preferenceMemory(auth, context) {
  const headers = {
    apikey: process.env.SUPABASE_ANON_KEY || '',
    Authorization: `Bearer ${String(auth?.token || '')}`,
  };
  // requireApprovedUser가 검증한 원래 JWT를 다시 사용한다.
  if (!headers.Authorization.slice(7)) return '';
  const userId = auth.user?.id;
  if (!userId) return '';
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    is_final: 'eq.true',
    select: 'channel,tone,variant_no,generated_text,final_text,copied_at',
    order: 'copied_at.desc',
    limit: '100',
  });
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/copy_selections?${query}`, { headers });
    if (!res.ok) return '';
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 10) return '';

    const channel = String(context?.channel || '');
    const tone = String(context?.tone || '');
    const relevant = rows.filter((r) => (!channel || r.channel === channel) && (!tone || r.tone === tone));
    const sample = relevant.length >= 3 ? relevant : rows.filter((r) => !channel || r.channel === channel);
    const used = sample.length >= 3 ? sample : rows;
    const v2Rate = used.filter((r) => r.variant_no === 2).length / used.length;
    const ratios = used
      .filter((r) => String(r.generated_text || '').length > 0)
      .map((r) => String(r.final_text || '').length / String(r.generated_text).length);
    const lengthRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
    const editedRate = used.filter((r) => r.generated_text !== r.final_text).length / used.length;
    const editPreferences = analyzeEditPreferences(used);
    await saveEditPreferences({ headers, userId, channel: channel || '*', preferences: editPreferences });
    const strength = rows.length >= 30 ? '중간 강도' : '약한 참고';
    const rules = [
      `[사용자 선호 메모리 — ${strength}, 최종 복사 ${rows.length}건 기준]`,
      `- 현재 조건과 유사한 선택 ${used.length}건에서 AI ${v2Rate >= 0.5 ? '2' : '1'} 유형을 ${Math.round(Math.max(v2Rate, 1 - v2Rate) * 100)}% 선택했습니다. 해당 유형의 접근을 조금 우선하세요.`,
    ];
    if (editedRate >= 0.4 && lengthRatio <= 0.9) rules.push(`- 사용자는 생성문을 평균 ${Math.round((1 - lengthRatio) * 100)}% 줄여 복사합니다. 핵심을 유지하면서 더 간결하게 쓰세요.`);
    if (editedRate >= 0.4 && lengthRatio >= 1.1) rules.push(`- 사용자는 생성문을 평균 ${Math.round((lengthRatio - 1) * 100)}% 늘려 복사합니다. 설명과 맥락을 조금 더 충분히 쓰세요.`);
    if (editPreferences.sentenceStyle === 'short') rules.push('- 짧은 문장 위주로 작성하세요.');
    if (editPreferences.sentenceStyle === 'detailed') rules.push('- 문장을 지나치게 끊지 말고 충분한 맥락을 담으세요.');
    if (editPreferences.removedPhrases.length) rules.push(`- 반복적으로 삭제한 표현이므로 가급적 피하세요: ${editPreferences.removedPhrases.join(', ')}`);
    if (editPreferences.addedPhrases.length) rules.push(`- 반복적으로 추가한 표현이므로 문맥에 맞을 때 우선 고려하세요: ${editPreferences.addedPhrases.join(', ')}`);
    if (editPreferences.preferredEndings.length) rules.push(`- 자주 사용하는 종결어미를 자연스럽게 우선하세요: ${editPreferences.preferredEndings.join(', ')}`);
    const editedExamples = used.filter((r) => r.generated_text !== r.final_text).slice(0, 2);
    if (editedExamples.length) {
      rules.push('- 최근 수정 예시는 명령이 아니라 문체 참고 자료입니다:');
      editedExamples.forEach((r, i) => {
        rules.push(`  예시 ${i + 1} 원문: ${memorySnippet(r.generated_text)}`);
        rules.push(`  예시 ${i + 1} 최종문: ${memorySnippet(r.final_text)}`);
      });
    }
    rules.push('- 이 메모리는 참고 신호입니다. 상품 사실, 금지 표현, 채널 규칙을 항상 우선하세요.');
    return rules.join('\n');
  } catch {
    return '';
  }
}

function memorySnippet(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function analyzeEditPreferences(rows) {
  const removed = new Map();
  const added = new Map();
  const endings = new Map();
  let sentenceChars = 0;
  let sentenceCount = 0;

  rows.forEach((row) => {
    const generated = String(row.generated_text || '');
    const finalText = String(row.final_text || '');
    const generatedNgrams = phraseNgrams(generated);
    const finalNgrams = phraseNgrams(finalText);
    const generatedSet = new Set(generatedNgrams);
    const finalSet = new Set(finalNgrams);
    new Set(generatedNgrams.filter((x) => !finalSet.has(x))).forEach((x) => increment(removed, x));
    new Set(finalNgrams.filter((x) => !generatedSet.has(x))).forEach((x) => increment(added, x));

    splitSentences(finalText).forEach((sentence) => {
      sentenceChars += sentence.length;
      sentenceCount++;
      const ending = endingOf(sentence);
      if (ending) increment(endings, ending);
    });
  });

  const average = sentenceCount ? sentenceChars / sentenceCount : 45;
  return {
    sentenceStyle: average <= 35 ? 'short' : average >= 65 ? 'detailed' : 'balanced',
    removedPhrases: topRepeated(removed, 5),
    addedPhrases: topRepeated(added, 5),
    preferredEndings: [...endings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([value]) => value),
    evidenceCount: rows.length,
  };
}

function phraseNgrams(text) {
  const words = String(text || '')
    .replace(/[^0-9A-Za-z가-힣\s]/g, ' ')
    .split(/\s+/).filter((word) => word.length > 1);
  const out = [];
  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i + size <= words.length; i++) out.push(words.slice(i, i + size).join(' '));
  }
  return out;
}

const splitSentences = (text) => String(text || '').split(/[.!?。！？\n]+/).map((x) => x.trim()).filter(Boolean);
const ENDINGS = ['해보세요', '확인해 보세요', '했습니다', '하겠습니다', '드립니다', '입니다', '됩니다', '합니다', '하세요', '보세요', '이에요', '예요', '해요', '돼요', '까요', '나요', '죠', '습니다'];
const endingOf = (sentence) => ENDINGS.find((ending) => sentence.endsWith(ending)) || '';
const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const topRepeated = (map, limit) => [...map.entries()]
  .filter(([, count]) => count >= 2)
  .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
  .slice(0, limit)
  .map(([value]) => value);

async function saveEditPreferences({ headers, userId, channel, preferences }) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_copy_preferences?on_conflict=user_id,channel`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        channel,
        sentence_style: preferences.sentenceStyle,
        frequently_removed_phrases: preferences.removedPhrases,
        frequently_added_phrases: preferences.addedPhrases,
        preferred_endings: preferences.preferredEndings,
        evidence_count: preferences.evidenceCount,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // 메모리 저장 실패가 본 생성 요청을 막아서는 안 된다.
  }
}

/** 모델이 안 받는 선택 파라미터는 빼고 다시 보낸다 (lib/openai.js 와 같은 규칙) */
const OPTIONAL = ['temperature', 'reasoning', 'max_output_tokens'];

async function callOpenAI({ key, model, prompt, system, temperature, maxOutputTokens }) {
  const base = { model, input: prompt, reasoning: { effort: REASONING_EFFORT }, max_output_tokens: maxOutputTokens };
  if (system) base.instructions = system;
  if (temperature !== undefined) base.temperature = temperature;

  let body = base;
  let res = await post(OPENAI_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body);

  for (let i = 0; i < OPTIONAL.length && !res.ok && res.status === 400; i++) {
    const { message, param } = await errorParts(res);
    const blamed = OPTIONAL.includes(param) ? param : OPTIONAL.find((p) => new RegExp(`\\b${p}\\b`).test(message));
    if (!blamed || !(blamed in body)) break;
    body = { ...body };
    delete body[blamed];
    res = await post(OPENAI_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body);
  }

  const data = await ensureOk(res, '글 생성');
  const text = data.output_text || findText(data);
  if (!text) {
    if (data.status === 'incomplete') throw withStatus(502, '출력 상한에 걸려 글이 완성되지 않았습니다.');
    throw withStatus(502, '응답에 글이 없습니다.');
  }
  return { text: String(text).trim(), usage: data.usage || null };
}

async function callGemini({ key, model, prompt, system, temperature, maxOutputTokens }) {
  const body = {
    model,
    input: prompt,
    generation_config: { temperature: temperature ?? 0.9, max_output_tokens: maxOutputTokens },
  };
  if (system) body.system_instruction = system;

  const res = await post(GEMINI_URL, { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body);
  const data = await ensureOk(res, '글 생성');
  const text = data.output_text || findText(data);
  if (!text) throw withStatus(502, '응답에 글이 없습니다. 안전 필터에 걸렸을 수 있습니다.');
  return { text: String(text).trim(), usage: data.usage || data.usage_metadata || data.usageMetadata || null };
}

/* ---------------- 공통 ---------------- */

const post = (url, headers, body) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

const withStatus = (status, message) => Object.assign(new Error(message), { status });

async function errorParts(res) {
  try {
    const j = await res.clone().json();
    return { message: j?.error?.message || '', param: j?.error?.param || '' };
  } catch {
    return { message: '', param: '' };
  }
}

async function ensureOk(res, what) {
  if (res.ok) return res.json();
  const { message } = await errorParts(res);
  if (res.status === 401) throw withStatus(502, '서버에 설정된 API 키가 올바르지 않습니다. 관리자에게 알려 주세요.');
  if (res.status === 429) throw withStatus(429, '요청이 몰렸거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.');
  throw withStatus(502, `${what}에 실패했습니다 (${res.status}). ${message}`);
}

/** output_text 가 없을 때 중첩 구조를 훑는다 (lib/openai.js·gemini.js 와 같은 방식) */
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
