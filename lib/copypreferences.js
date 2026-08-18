import { getClient } from './supabase.js';
import { getUser } from './auth.js';

/**
 * 클립보드 복사가 성공한 AI 결과만 선호 데이터로 기록한다.
 * 이전 행은 보존하고, DB 함수가 같은 생성 묶음·채널의 최신 행만 is_final=true로 만든다.
 */
export async function recordCopySelection(data) {
  if (!getUser()) return { ok: false, skipped: true };
  const sb = await getClient();
  if (!sb) return { ok: false, skipped: true };

  const { data: id, error } = await sb.rpc('record_copy_selection', {
    p_generation_group_id: data.generationGroupId,
    p_channel: data.channel,
    p_variant_no: data.variantNo,
    p_product_id: data.productId || null,
    p_topic: data.topic || '',
    p_tone: data.tone || '',
    p_generated_text: data.generatedText,
    p_final_text: data.finalText,
  });

  if (error) {
    console.warn('[copy-preferences] 복사 선택 저장 실패', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id };
}
