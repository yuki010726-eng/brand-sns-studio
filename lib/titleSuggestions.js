import { generateText } from "./llm.js";

const TITLE_COUNT = 3;
const MAX_TITLE_LENGTH = 42;
const titleSuggestionCache = new Map();

export function titleSuggestionKey(product, state) {
  return `${String(product?.id || "").trim()}|${String(state?.topic || "").trim()}`;
}

export function cachedTitleSuggestions(product, state) {
  return titleSuggestionCache.get(titleSuggestionKey(product, state)) || null;
}

export function cacheTitleSuggestions(product, state, titles) {
  const cleaned = [...new Set((Array.isArray(titles) ? titles : []).map(clean).filter(Boolean))]
    .slice(0, TITLE_COUNT);
  if (cleaned.length) titleSuggestionCache.set(titleSuggestionKey(product, state), cleaned);
  return cleaned;
}

function clean(value) {
  return String(value || "")
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/^[『「'"`]|[』」'"`]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTitles(raw) {
  const source = String(raw || "").replace(/```(?:json)?|```/gi, "").trim();
  try {
    const match = source.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : source);
    return [...new Set((Array.isArray(parsed) ? parsed : []).map(clean))]
      .filter((title) => title.length >= 4 && title.length <= MAX_TITLE_LENGTH);
  } catch {
    return [...new Set(source.split("\n").map(clean))]
      .filter((title) => title.length >= 4 && title.length <= MAX_TITLE_LENGTH);
  }
}

export function fallbackTitles(product, topic) {
  const productName = String(product?.name || "").trim();
  const subject = String(topic || "").trim() || productName || "이번 이야기";
  return [
    `${subject}, 핵심부터 짚어봅니다`,
    `${subject}에서 놓치기 쉬운 포인트`,
    `${productName ? `${productName}로 풀어본 ` : ""}${subject}의 실제 기준`,
  ].filter((title, index, titles) => title && titles.indexOf(title) === index).slice(0, TITLE_COUNT);
}

export async function getTitleSuggestions(product, state, options = {}) {
  const cached = cachedTitleSuggestions(product, state);
  if (cached) return cached;
  const proofs = [...new Set((product?.voice?.proof || []).map(clean).filter(Boolean))].slice(0, 12);
  const prompt = `상품명: ${product?.name || "상품"}
주제: ${String(state?.topic || "").trim()}
특히 강조할 내용: ${String(state?.focusPoint || "").trim() || "없음"}

위 상품과 주제에 정확히 맞는 SNS 게시물 제목 3개를 새로 작성해 주세요.

규칙:
- 세 제목은 서로 다른 후킹 방식으로 작성
- 주제의 대상과 질문을 바꾸지 않기
- 상품명만 바꿔 끼우는 상투적인 제목이나 고정 템플릿 금지
- 독자가 게시물 내용을 궁금해할 구체적인 한국어 제목
- 과장, 허위 사실, 근거 없는 숫자 금지
- 제목마다 12~32자 권장, 최대 ${MAX_TITLE_LENGTH}자
- JSON 문자열 배열만 출력

확인된 상품 근거:
${proofs.length ? proofs.map((item) => `- ${item}`).join("\n") : "- 별도 근거 없음. 주어진 상품명과 주제 범위만 사용"}`;

  const raw = await generateText(prompt, {
    system: "당신은 상품 정보와 사용자가 정한 주제를 읽고, 매번 새로운 한국어 콘텐츠 제목을 제안하는 브랜드 에디터입니다.",
    maxOutputTokens: 260,
    temperature: 0.9,
    usageType: "topic_recommendation",
    signal: options.signal,
  });
  const titles = parseTitles(raw);
  if (titles.length < TITLE_COUNT) throw new Error("AI가 제목 3개를 완성하지 못했습니다.");
  return cacheTitleSuggestions(product, state, titles);
}
