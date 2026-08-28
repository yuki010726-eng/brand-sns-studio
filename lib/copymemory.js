/**
 * 스타일 메모리 챗봇 — 개인 전용.
 *
 * CopyEditor 옆 채팅에서 나눈 대화를 Supabase 에 쌓고(`copy_chat_messages`), 매 대화 뒤
 * 짧게 다시 쓴 요약 한 행(`user_writing_memory`)으로 남긴다. 다음에 다른 글을 AI로 만들 때
 * 그 요약이 `lib/copyai.js` 의 프롬프트에 자동으로 들어간다 — `memoryBlock()` 참고.
 *
 * ⚠️ **원문 대화를 프롬프트에 통째로 넣지 않는다.** CLAUDE.md 8-18 이 "프롬프트가 길어질수록
 *    규칙 준수에 여력을 뺏겨 글이 나빠진다"는 걸 이미 겪었다. 그래서 생성 프롬프트에는
 *    요약본만 들어간다. 원문은 이 화면에서 대화를 이어가기 위한 이력일 뿐이다.
 *
 * ⚠️ **PLAN_V2.md 의 팀 공용 메모리와는 다른 기능이다.** 이건 개인 전용이고, 저장·반영에
 *    승인 절차가 없다 (요청자 결정 2026-08-26). 팀 자산으로 확장하려면 별도 결정이 필요하다.
 *
 * OpenAI 호출은 `app/api/chat` 서버 라우트를 거친다 — 키를 서버에만 두기 위해서다.
 * Supabase 읽기·쓰기는 여기서 로그인 세션이 있는 브라우저 클라이언트로 바로 한다
 * (RLS 로 보호된다 — `lib/copypreferences.js` 와 같은 방식).
 */
import { getClient } from './supabase.js';
import { getUser, accessToken } from './auth.js';

const HISTORY_LIMIT = 40; // 화면에 불러오는 최근 대화 개수
const CONTEXT_MESSAGES = 12; // 챗봇 호출 · 요약 호출에 넘기는 최근 대화 개수 (비용 상한)
export const SUMMARY_MAX_CHARS = 900;

/** 최근 대화를 오래된 순으로 불러온다. 로그인 전이거나 설정이 없으면 빈 배열이다. */
export async function loadMessages(contextKey = 'global') {
  const user = getUser();
  if (!user) return [];
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('copy_chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .eq('context_key', contextKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    console.warn('[copy-memory] 대화 불러오기 실패', error.message);
    return [];
  }
  return (data || []).slice().reverse();
}

/** 메시지 한 줄을 저장한다. 실패해도 화면 흐름은 막지 않는다 — 이력은 부가 기능이다. */
export async function saveMessage(role, content, contextKey = 'global') {
  const user = getUser();
  if (!user) return { ok: false, skipped: true };
  const sb = await getClient();
  if (!sb) return { ok: false, skipped: true };
  const { error } = await sb
    .from('copy_chat_messages')
    .insert({ user_id: user.id, role, content, context_key: contextKey });
  if (error) {
    console.warn('[copy-memory] 대화 저장 실패', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** 저장된 스타일 요약. 없으면 null. */
export async function getMemorySummary() {
  const user = getUser();
  if (!user) return null;
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('user_writing_memory')
    .select('summary, message_count, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('[copy-memory] 요약 불러오기 실패', error.message);
    return null;
  }
  return data;
}

/** 한 시안의 대화 이력만 지운다. 공용 스타일 요약은 다음 생성에 계속 활용한다. */
export async function clearMemory(contextKey = 'global') {
  const user = getUser();
  if (!user) return { ok: false, skipped: true };
  const sb = await getClient();
  if (!sb) return { ok: false, skipped: true };
  const { error } = await sb
    .from('copy_chat_messages')
    .delete()
    .eq('user_id', user.id)
    .eq('context_key', contextKey);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function callChatApi(payload) {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다.');
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '요청에 실패했습니다.');
  return data;
}

/** 최근 대화(+ 새 사용자 메시지)를 챗봇에 보내고 답을 받는다. */
export async function sendChat(messages) {
  const recent = messages.slice(-CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content }));
  const { reply } = await callChatApi({ mode: 'chat', messages: recent });
  return reply;
}

/** 이전 요약 + 최근 대화를 합쳐 요약을 다시 쓰고, 그 결과를 반환한다 (저장은 호출부 몫). */
export async function refreshSummary(priorSummary, messages) {
  const recent = messages.slice(-CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content }));
  const { summary } = await callChatApi({ mode: 'summarize', priorSummary: priorSummary || '', messages: recent });
  return summary;
}

/**
 * 방금 챗봇에게 보낸 요청을, 지금 화면에 떠 있는 시안(draft)에 직접 반영한다.
 *
 * ⚠️ 스타일 요약(`refreshSummary`)과는 다르다 — 요약은 "다음에 새로 만들 글"에만 참고되고,
 *    「AI 생성」을 다시 눌러야 눈에 보였다. 이건 그와 별개로, 지금 보고 있는 시안 자체를
 *    고쳐서 바로 눈에 보이게 한다(요청자 지시 2026-08-26).
 *
 * 요청이 원고와 무관한 잡담이면 서버가 원고를 그대로 돌려주므로, 여기서 원문과 같으면
 * "반영할 게 없었다"로 보고 null 을 돌려준다 — 호출부가 토스트를 띄우지 않게 하기 위해서다.
 *
 * @returns {Promise<string|null>} 반영된 새 원고, 반영할 것이 없었으면 null
 */
export async function reviseDraftWithChat(instruction, draft, channelId) {
  const text = String(draft || '').trim();
  const ask = String(instruction || '').trim();
  if (!text || !ask) return null;
  const { draft: revised } = await callChatApi({ mode: 'revise', instruction: ask, draft: text, channelId });
  const next = String(revised || '').trim();
  if (!next || next === text) return null;
  // 절반 이하로 줄었으면 문단을 통째로 날린 것으로 본다 (lib/copyai.js 의 reviseDraft 와 같은 안전장치).
  if (next.length < text.length * 0.5) return null;
  return next;
}

/** 새 요약을 저장한다. */
export async function saveMemorySummary(summary, messageCount) {
  const user = getUser();
  if (!user) return { ok: false, skipped: true };
  const sb = await getClient();
  if (!sb) return { ok: false, skipped: true };
  const { error } = await sb.from('user_writing_memory').upsert({
    user_id: user.id,
    summary,
    message_count: messageCount,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[copy-memory] 요약 저장 실패', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 프롬프트에 넣을 메모리 블록.
 *
 * `lib/blogstyles.js` 의 `styleBlock()` 과 같은 원칙이다 — **이 블록이 이길 수 있는 건
 * "이렇게 씁니다" 뿐이고, 사실·금지 표현·채널 규칙은 못 이긴다.** 그 경계를 문구로도 못박는다.
 *
 * @param {string} summary
 * @returns {string} 요약이 없으면 빈 문자열
 */
export function memoryBlock(summary) {
  const body = String(summary || '').trim();
  if (!body) return '';
  return [
    '■ 이 사용자의 스타일 메모 — 챗봇과 나눈 대화에서 정리됨',
    '',
    '**아래는 이 사용자가 평소 선호하는 말투·표현입니다. 다른 절과 충돌하지 않는 범위에서 참고합니다.**',
    body,
    '',
    '⚠️ 여기 적힌 것은 문체 참고일 뿐입니다. 상품 사실·숫자·금지 표현·채널 규칙·소제목 개수는',
    '   이 메모로 바꾸지 않습니다. 다른 절에 「하지 않습니다·쓰지 마세요·실패입니다」로 적힌 것이',
    '   항상 이깁니다.',
    '── 스타일 메모 끝 ──',
  ].join('\n');
}
