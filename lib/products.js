/** Supabase에서 불러온 상품을 앱 전체가 동기적으로 공유하는 저장소. */
import { getClient } from './supabase.js';

export const PRODUCTS = [];
export const getProduct = (id) => PRODUCTS.find((product) => product.id === id) || null;

const shuffled = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

/** DB의 최신 추천 주제 중 무작위 4개를 반환한다. */
export async function loadRandomTopicPresets(productId) {
  if (!productId) return [];
  const client = await getClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const { data, error } = await client
    .from('products')
    .select('prompt_settings')
    .eq('id', productId)
    .eq('is_active', true)
    .single();
  if (error) throw error;

  const topics = Array.isArray(data?.prompt_settings?.topicPresets)
    ? data.prompt_settings.topicPresets
        .map((topic) => String(topic || '').trim())
        .filter(Boolean)
    : [];
  return shuffled([...new Set(topics)]).slice(0, 4);
}

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
    // Structured proofs are preserved for AI prompts, but the rule-based
    // copywriter expects plain display strings in `voice.proof`.
    const proofText = (item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const label = String(item.label || '').trim();
      const value = String(item.value ?? item.content ?? '').trim();
      return [label, value].filter(Boolean).join(': ');
    };
    const approvedText = approvedContent.map(proofText).filter(Boolean);
    const sources = list(sourceRows).map((source) => ({
      url: source.source_url,
      content: list(source.source_content),
    }));
    const voice = settings.voice || {};

    // 007부터 product_proofs는 종류별 여러 행이 아니라 상품별 통합 근거 1행이다.
    // 문구 역할별 설정은 prompt_settings에 있으면 사용하고, 기존 상품 데이터가
    // 계속 동작하도록 voice의 승인 문구를 보조값으로 사용한다.
    const appeals = list(settings.appeals).length ? list(settings.appeals) : list(voice.hooks);
    // 공용 마무리 문구가 있으면 우선 사용한다. 아직 closings가 분리되지 않은 기존
    // 상품은 빈 결론 카드가 생기지 않도록 예전 승인 문구를 보조값으로 유지한다.
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
      // 원본 구조를 보존한다. 글 생성기는 문자열 배열과
      // { category, label, value, type } 형식을 모두 읽는다.
      productProofs: approvedContent,
      ...(details.host ? { host: details.host } : {}),
      voice: {
        ...voice,
        // 예전 호출부 호환용. 규칙 기반 생성기에는 표시 문자열로 전달한다.
        proof: approvedText,
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
