import { generateText } from "./llm.js";

const TOPIC_COUNT = 4;
const MAX_TOPIC_LENGTH = 28;

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function clean(value) {
  return String(value || "")
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validTopic(topic) {
  if (topic.length < 4 || topic.length > MAX_TOPIC_LENGTH) return false;
  if (/(?:합니다|됩니다|입니다|습니다|해야|하고|하며|인데|이라는|한다는|점이|까지)$/u.test(topic)) return false;
  return true;
}

function parseTopics(raw) {
  const source = String(raw || "").replace(/```(?:json)?|```/gi, "").trim();
  try {
    const match = source.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : source);
    return [...new Set((Array.isArray(parsed) ? parsed : []).map(clean).filter(validTopic))];
  } catch {
    return [...new Set(source.split("\n").map(clean).filter(validTopic))];
  }
}

function fallbackTopics(product, previous) {
  const previousSet = new Set(previous);
  const topics = [...new Set((product?.topicPresets || []).map(clean).filter(validTopic))];
  return [
    ...shuffle(topics.filter((topic) => !previousSet.has(topic))),
    ...shuffle(topics.filter((topic) => previousSet.has(topic))),
  ].slice(0, TOPIC_COUNT);
}

export async function getTopicSuggestions(product, previous = [], options = {}) {
  const proofs = [...new Set((product?.voice?.proof || []).map(clean).filter(Boolean))];
  if (!proofs.length) return fallbackTopics(product, previous);

  const materials = shuffle(proofs).slice(0, 18);
  const prompt = `상품명: ${product?.name || "상품"}

아래 사실을 바탕으로 SNS 게시물의 "주제명" 4개를 만들어 주세요.

규칙:
- 문장을 자르거나 요약문을 만들지 말고, 게시물 한 편의 중심이 되는 완결된 주제명을 작성
- 8~22자 내외의 짧은 명사형
- "~합니다/~됩니다/~해야" 같은 문장형과 서술형 금지
- 조사나 연결어로 끝나는 불완전한 표현 금지
- 서로 다른 내용으로 구성
- 사실에 없는 내용을 추가하지 않기
- 좋은 예: "소비자 평가 기반 인증 방식", "자막 소재 제출 기한", "기본 특전 및 추가 패키지", "심사 기준 및 항목별 비중"
- 나쁜 예: "심사가 소비자 평가에 근거한다는 점이", "자막 소재는 온에어 7일 전까지 넘겨야"
- JSON 문자열 배열만 출력

이번에 제외할 주제:
${previous.length ? previous.map((item) => `- ${item}`).join("\n") : "- 없음"}

근거 사실:
${materials.map((item) => `- ${item}`).join("\n")}`;

  try {
    const raw = await generateText(prompt, {
      system: "당신은 긴 상품 근거를 짧고 완결된 한국어 콘텐츠 주제명으로 편집하는 에디터입니다.",
      maxOutputTokens: 220,
      temperature: 0.8,
      reasoningEffort: "low",
      usageType: 'topic_recommendation',
      signal: options.signal,
    });
    const generated = parseTopics(raw).filter((topic) => !previous.includes(topic));
    if (generated.length >= TOPIC_COUNT) return generated.slice(0, TOPIC_COUNT);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.warn("[topics] AI topic generation failed; using curated presets.", error);
  }

  return fallbackTopics(product, previous);
}
