/** Supabase에서 불러온 상품을 앱 전체가 동기적으로 공유하는 저장소. */
import { getClient } from './supabase.js';

export const PRODUCTS = [];
export const getProduct = (id) => PRODUCTS.find((product) => product.id === id) || null;

let loaded = false;

export async function loadProducts() {
  if (loaded) return PRODUCTS;

  const client = await getClient();
  if (!client) {
    console.warn('[products] Supabase 클라이언트가 없어 상품을 불러올 수 없습니다.');
    return PRODUCTS;
  }

  const { data, error } = await client
    .from('products')
    .select(`
      id, icon, name, tagline, intake, handle, summary, site,
      facts, benefits, details, cautions, prompt_settings,
      product_proofs(content_type, content, sort_order)
    `)
    .eq('is_active', true)
    .eq('product_proofs.is_active', true)
    .order('sort_order')
    .order('sort_order', { referencedTable: 'product_proofs' });

  if (error) {
    console.error('[products] Supabase 상품 조회에 실패했습니다.', error);
    return PRODUCTS;
  }

  const products = (data || []).map((row) => {
    const { product_proofs: proofRows, prompt_settings: settings = {}, details = {}, ...card } = row;
    const contentByType = Object.fromEntries(
      (proofRows || []).map((proof) => [proof.content_type, proof.content || []]),
    );
    return {
      ...card,
      facts: Array.isArray(card.facts) ? card.facts : [],
      benefits: Array.isArray(card.benefits) ? card.benefits : [],
      short: settings.short || card.name,
      hashtags: Array.isArray(settings.hashtags) ? settings.hashtags : [],
      topicPresets: Array.isArray(settings.topicPresets) ? settings.topicPresets : [],
      targets: Array.isArray(settings.targets) ? settings.targets : [],
      appeals: contentByType.appeal || [],
      closings: contentByType.closing || [],
      cautions: contentByType.caution || card.cautions || [],
      packages: Array.isArray(details.packages) ? details.packages : [],
      events: Array.isArray(details.events) ? details.events : [],
      criteria: Array.isArray(details.criteria) ? details.criteria : [],
      ...(details.host ? { host: details.host } : {}),
      voice: {
        ...(settings.voice || {}),
        contentByType,
        proof: contentByType.fact || [],
        ctas: contentByType.cta || [],
      },
    };
  });

  PRODUCTS.splice(0, PRODUCTS.length, ...products);
  loaded = true;

  const { refreshProfileProducts } = await import('./profile.js');
  refreshProfileProducts();
  return PRODUCTS;
}
