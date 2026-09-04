/** 서버의 OpenAI 프록시를 호출하는 App Router 클라이언트. */
import { accessToken } from './auth.js';

async function authHeaders() {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function readError(response) {
  try {
    const body = await response.json();
    return body?.error || `요청에 실패했습니다 (${response.status}).`;
  } catch {
    return `요청에 실패했습니다 (${response.status}).`;
  }
}

export async function generateText(prompt, opts = {}) {
  let response;
  try {
    response = await fetch('/api/text', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        prompt,
        system: opts.system,
        temperature: opts.temperature,
        reasoningEffort: opts.reasoningEffort,
        maxOutputTokens: opts.maxOutputTokens,
        memoryContext: opts.memoryContext,
        usageType: opts.usageType,
        proposalUrl: opts.proposalUrl,
      }),
      signal: opts.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.message.includes('로그인')) throw error;
    throw new Error('AI 생성 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');
  }

  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  if (body.usage) opts.onUsage?.(body.usage);
  if (!body.text) throw new Error('AI 응답 내용이 없습니다.');
  return String(body.text).trim();
}
