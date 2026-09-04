/**
 * 미리보기 화면에서 "새 내용"만 걸러내는 순수 로직.
 * 옛 pages/products-admin.js 에서 그대로 옮겼다 — 프레임워크에 의존하지 않는 코드라 로직은 손대지 않았다.
 */

const FACT_WORDS = /(?:주최|주관|후원|개최|일정|시상식|접수|신청|모집|마감|발표|심사|선정|평가|기준|부문|대상|자격|제출|서류|절차|특전|제공|지원|수상|인증|엠블럼|상장|상패|기사|영상|광고|송출|채널|장소|호텔|그랜드볼룸|비대면|연중|상시|무료|무상|포함|제외|가능|불가)/;
const NUMBER_FACT = /(?:\d{4}\s*년|\d{1,2}\s*월|\d{1,2}\s*일|\d{1,2}\s*시|\d+(?:[.,]\d+)?\s*(?:개|명|곳|종|회|점|%|퍼센트|만원|원|초|분|가구|채널))/;
const NOISE = /(?:안녕하세요|반갑습니다|오늘은|포스팅|블로그|공감|댓글|이웃추가|서이추|문의주세요|문의 주세요|클릭|링크|카테고리|프로필|로그인|작성자|저작권|무단전재|내돈내산|협찬|소정의|원고료)/i;
const OPINION = /(?:것 같|느꼈|생각했|추천드|추천해|좋았|아쉬웠|다녀왔|방문했|궁금하|어떠셨|해보세요|바랍니다)/;

export function extractPreviewItems(items, product) {
  const existingContent = product?.voice?.proof || [];
  const productTokens = keywordTokens(`${product?.name || ""} ${product?.summary || ""}`);
  return items.map((item) => {
    if (item.error) return item;
    const extracted = extractFacts(item.content || [], productTokens)
      .filter((line) => !existingContent.some((known) => isDuplicateContent(line, known)));
    return { ...item, newContent: extracted };
  });
}

function extractFacts(lines, productTokens) {
  const candidates = lines.flatMap(splitSourceSentences)
    .map(cleanSourceSentence)
    .filter((line) => line.length >= 12 && line.length <= 500)
    .filter((line) => !NOISE.test(line) && !OPINION.test(line))
    .filter((line) => {
      const normalized = normalizeContent(line);
      const productMatch = productTokens.some((token) => normalized.includes(token));
      const factSignal = FACT_WORDS.test(line) || NUMBER_FACT.test(line);
      return factSignal && (productMatch || factSignalScore(line) >= 2);
    });
  const unique = [];
  for (const candidate of candidates) {
    if (!unique.some((known) => isDuplicateContent(candidate, known))) unique.push(candidate);
  }
  return unique.slice(0, 40);
}

function splitSourceSentences(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return [];
  return text.split(/(?<=[.!?。！？])\s+|\s*[|｜]\s*/).filter(Boolean);
}

function cleanSourceSentence(value) {
  const line = String(value).replace(/^\s*(?:[-*•▶▷✓✔]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim();
  if (!line || /[.!?。！？]$/.test(line)) return line;
  return `${line}.`;
}

function keywordTokens(value) {
  const stopwords = new Set(["브랜드", "어워즈", "대한민국", "상품", "서비스", "진행", "관련", "기반"]);
  return [...new Set(normalizeContent(value).split(/[^0-9a-z가-힣]+/).filter((token) => token.length >= 2 && !stopwords.has(token)))];
}

function factSignalScore(value) {
  let score = (String(value).match(new RegExp(FACT_WORDS.source, "g")) || []).length;
  if (NUMBER_FACT.test(value)) score += 1;
  if (/(?:에서|까지|부터|통해|기준|대상|제공|진행|열린|개최)/.test(value)) score += 1;
  return score;
}

const normalizeContent = (value) => String(value).replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");

function isDuplicateContent(left, right) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (numberKey(a) !== numberKey(b)) return false;
  return similarity(a, b) >= 0.82;
}

const normalizeComparable = (value) => normalizeContent(value)
  .replace(/[^0-9a-z가-힣]/g, "")
  .replace(/(?:열립니다|열린다|입니다|됩니다|합니다|습니다|이다|한다|된다)$/u, "");
const numbersOf = (value) => String(value).match(/\d+(?:[.,]\d+)*/g) || [];
const numberKey = (value) => [...new Set(numbersOf(value))].sort().join("|");

function similarity(a, b) {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;
  const row = Array.from({ length: shorter.length + 1 }, (_, index) => index);
  for (let i = 1; i <= longer.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (longer[i - 1] === shorter[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - row[shorter.length] / longer.length;
}
