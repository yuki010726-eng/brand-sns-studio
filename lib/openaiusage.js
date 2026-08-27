/** OpenAI 사용량 로그에서 사용하는 기능 구분값. */
export const OPENAI_USAGE_TYPES = Object.freeze({
  TEXT_GENERATION: 'text_generation',
  TOPIC_RECOMMENDATION: 'topic_recommendation',
  OUTLINE_GENERATION: 'outline_generation',
  BLOG_GENERATION: 'blog_generation',
  BLOG_REVISION: 'blog_revision',
  INSTAGRAM_GENERATION: 'instagram_generation',
  THREADS_GENERATION: 'threads_generation',
  CARD_NEWS_GENERATION: 'card_news_generation',
  SOCIAL_BUNDLE_GENERATION: 'social_bundle_generation',
  STYLE_ANALYSIS: 'style_analysis',
  COPY_CHAT: 'copy_chat',
  COPY_SUMMARY: 'copy_summary',
  COPY_REVISION: 'copy_revision',
  IMAGE_GENERATION: 'image_generation',
});

const ALLOWED_TYPES = new Set(Object.values(OPENAI_USAGE_TYPES));

export const normalizeOpenAIUsageType = (value, fallback = OPENAI_USAGE_TYPES.TEXT_GENERATION) =>
  ALLOWED_TYPES.has(value) ? value : fallback;

/**
 * 로그인 사용자의 JWT로 Supabase REST API에 사용량을 기록한다.
 * 로깅 장애 때문에 이미 완성된 콘텐츠 생성까지 실패시키지는 않는다.
 */
export async function recordOpenAIUsage({ supabaseUrl, anonKey, token, userId, type, model, responseId, usage }) {
  if (!supabaseUrl || !anonKey || !token || !userId) return false;

  const tokenUsage = usage || {};

  const row = {
    user_id: userId,
    type: normalizeOpenAIUsageType(type),
    model: String(model || 'unknown'),
    input_tokens: integer(tokenUsage.input_tokens),
    output_tokens: integer(tokenUsage.output_tokens),
    total_tokens: integer(tokenUsage.total_tokens),
    cached_tokens: integer(tokenUsage.input_tokens_details?.cached_tokens),
    reasoning_tokens: integer(tokenUsage.output_tokens_details?.reasoning_tokens),
    openai_response_id: responseId ? String(responseId) : null,
  };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/openai_usage_logs`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      console.error(`[openai-usage] Supabase insert failed (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[openai-usage] Supabase insert failed.', error);
    return false;
  }
}

const integer = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};
