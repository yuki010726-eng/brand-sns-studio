/** 기본 글 톤의 문체 레퍼런스. 링크는 출처 추적용이며 원문 문장은 복제하지 않는다. */
export const TONE_REFERENCES = {
  trust: [
    { title: '전환율 높이는 상세 페이지 디자인, 바로 써보는 3가지 방법', url: 'https://yozm.wishket.com/magazine/detail/546/' },
    { title: 'AI의 파도 속에서 글쓰기와 브랜딩이 살아남는 방법', url: 'https://yozm.wishket.com/magazine/detail/2465/' },
    { title: '네이버 블로그 신뢰 정보형 레퍼런스', url: 'https://m.blog.naver.com/653864/224338868982' },
  ],
  hook: [
    { title: '작은 브랜드가 바로 써먹는 상세페이지 9단계 구조', url: 'https://brunch.co.kr/@designmydesign/4' },
    { title: '쿠팡 광고비 낭비 공통점', url: 'https://brunch.co.kr/@6dabc3ac82bb40e/40' },
  ],
  plain: [
    { title: '이메일 발송 전 체크리스트 12가지', url: 'https://blog.stibee.com/email-send-checklist/' },
    { title: '오픈율을 높이는 이메일 제목 작성법 3가지', url: 'https://blog.stibee.com/email-open-rate-subject-line-tips/' },
  ],
  celebrate: [
    { title: '스티비 2023 이메일 마케팅 리포트 미리보기', url: 'https://blog.stibee.com/seutibi-2023-imeil-maketing-ripoteu-miribogi/' },
    { title: 'Threads, 출시 1주년 맞아 그간의 기록 발표', url: 'https://about.fb.com/ko/news/2024/07/threads-first-anniversary/' },
  ],
};

const TONE_REFERENCE_GUIDES = {
  trust: [
    '- 개념이나 결론을 먼저 정의하고, 근거·수치·사례를 논리적인 순서로 붙입니다.',
    '- 소제목만 훑어도 논지가 보이게 구성하고, 마지막에는 핵심 원칙을 다시 정리합니다.',
    '- 전문성을 유지하되 어려운 용어는 바로 풀어 설명합니다.',
  ],
  hook: [
    '- 독자가 겪는 손실, 실수, 막막함을 구체적인 첫 문장으로 짚어 시선을 잡습니다.',
    '- 질문이나 의외의 사실로 연 뒤 곧바로 해결 구조와 실무 예시를 제시합니다.',
    '- 불안을 과장하거나 독자를 몰아세우지 말고, 공감 뒤에 분명한 해법을 둡니다.',
  ],
  plain: [
    '- 결론과 실행 항목을 앞에 두고 체크리스트나 짧은 단계로 정리합니다.',
    '- 한 문단에는 한 가지 요점만 담고, 각 항목은 이유와 적용법까지만 설명합니다.',
    '- 수식어와 긴 도입을 줄이고 바로 따라 할 수 있는 표현을 씁니다.',
  ],
  celebrate: [
    '- 발표할 소식과 핵심 성과를 첫 문단에서 바로 밝힙니다.',
    '- 숫자, 기간, 참여 규모처럼 축하할 이유가 되는 기록을 선명하게 보여줍니다.',
    '- 밝고 감사한 분위기를 유지하되 과장된 감탄보다 다음 계획과 의미로 마무리합니다.',
  ],
};

export function toneReferenceBlock(tone) {
  const references = TONE_REFERENCES[tone] || [];
  const guide = TONE_REFERENCE_GUIDES[tone] || [];
  if (!references.length || !guide.length) return '';
  return [
    '■ 톤별 블로그 레퍼런스에서 가져온 문체 원칙',
    ...guide,
    '원문의 고유 문장이나 표현은 복제하지 않습니다.',
    `참고 출처: ${references.map(({ title, url }) => `${title} (${url})`).join(' / ')}`,
  ].join('\n');
}
