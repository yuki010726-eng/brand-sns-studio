import { accessToken } from './auth.js';
import { generateText } from './llm.js';

const ANALYSIS_TOKENS = 1800;

function analysisPrompt(article) {
  return [
    '아래 네이버 블로그 글에서 내용이 아닌 글 스타일만 분석해, 다른 주제의 글에도 적용할 수 있는 한국어 문체 가이드를 작성하세요.',
    '원문의 고유 문장, 비유, 사실, 숫자, 제품명은 복사하지 말고 문체의 일반적인 특징만 추출하세요.',
    '각 항목은 감상이 아니라 그대로 따라 쓸 수 있는 구체적인 지시로 적고, 셀 수 있는 요소는 숫자로 표현하세요.',
    '',
    '다음 7개 항목만 번호를 붙여 작성하세요.',
    '1. 한 줄 분위기 요약',
    '2. 도입 방식 — 첫 문단의 방식과 본론 진입 시점',
    '3. 문장 길이와 리듬 — 평균 길이, 문단과 줄바꿈 기준',
    '4. 소제목과 전체 구성 — 개수, 형태, 전개 순서',
    '5. 정보와 개인 경험의 비율과 배치',
    '6. 어휘·존댓말·이모지·강조 방식 — 자주 쓰는 어미와 표현 규칙',
    '7. 피해야 할 요소',
    '',
    `[참고 글: ${article.title || '제목 없음'}]`,
    article.text.slice(0, 12000),
  ].join('\n');
}

async function collect(url, signal) {
  const token = await accessToken();
  if (!token) throw new Error('블로그 글을 확인하려면 로그인이 필요합니다.');
  const response = await fetch('/api/research/collect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ urls: [url] }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '블로그 글을 불러오지 못했습니다.');
  const article = data.items?.[0];
  if (!article || article.error || !article.text) {
    throw new Error(article?.error || '블로그 본문을 충분히 읽지 못했습니다.');
  }
  return article;
}

export async function analyzeCustomBlogStyle(url, options = {}) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('https://로 시작하는 네이버 블로그 글 링크를 입력해 주세요.');
  }
  const article = await collect(value, options.signal);
  const guide = await generateText(analysisPrompt(article), {
    maxOutputTokens: ANALYSIS_TOKENS,
    signal: options.signal,
  });
  if (!guide.trim()) throw new Error('블로그 글 스타일을 분석하지 못했습니다.');
  return guide.trim();
}
