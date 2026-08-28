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
      id, icon, name, tagline, intake, handle, summary, site, proposal_url,
      facts, benefits, details, cautions, prompt_settings,
      product_proofs(content),
      product_sources(source_url, source_content)
    `)
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[products] Supabase 상품 조회에 실패했습니다.', error);
    return PRODUCTS;
  }

  const products = (data || []).map((row) => {
    const {
      product_proofs: proofRows,
      product_sources: sourceRows,
      prompt_settings: settings = {},
      details = {},
      ...card
    } = row;
    const list = (value) => Array.isArray(value) ? value : [];
    // product_id UNIQUE 관계는 Supabase가 단일 객체로 반환할 수 있고,
    // 스키마 캐시 갱신 전에는 배열로 반환할 수도 있어 양쪽을 모두 받는다.
    const proof = Array.isArray(proofRows) ? proofRows[0] : proofRows;
    const approvedContent = list(proof?.content);
    const sources = list(sourceRows).map((source) => ({
      url: source.source_url,
      content: list(source.source_content),
    }));
    const voice = settings.voice || {};

    // 007부터 product_proofs는 종류별 여러 행이 아니라 상품별 통합 근거 1행이다.
    // 문구 역할별 설정은 prompt_settings에 있으면 사용하고, 기존 상품 데이터가
    // 계속 동작하도록 voice의 승인 문구를 보조값으로 사용한다.
    const appeals = list(settings.appeals).length ? list(settings.appeals) : list(voice.hooks);
    const closings = list(settings.closings).length
      ? list(settings.closings)
      : list(voice.threads?.closes);
    const ctas = list(settings.ctas).length ? list(settings.ctas) : list(voice.ctas);
    return {
      ...card,
      facts: list(card.facts),
      benefits: list(card.benefits),
      short: settings.short || card.name,
      hashtags: list(settings.hashtags),
      topicPresets: list(settings.topicPresets),
      targets: list(settings.targets),
      appeals,
      closings,
      cautions: list(card.cautions),
      packages: list(details.packages),
      events: list(details.events),
      criteria: list(details.criteria),
      sources,
      ...(details.host ? { host: details.host } : {}),
      voice: {
        ...voice,
        proof: approvedContent,
        ctas,
        sources,
      },
    };
  });

  PRODUCTS.splice(0, PRODUCTS.length, ...products);
  loaded = true;

  const { refreshProfileProducts } = await import('./profile.js');
  refreshProfileProducts();
  return PRODUCTS;
}

/** 관리자 업데이트 직후 서버의 최신 상품 자료를 다시 읽는다. */
export async function reloadProducts() {
  loaded = false;
  return loadProducts();
}
