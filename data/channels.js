/** 게시 채널 정의. */
export const CHANNELS = [
  {
    id: 'blog',
    name: '블로그',
    icon: 'blog',
    hint: '검색 유입 중심 · 장수에 맞춰 700~1,600자 + 이미지 + 캡션',
    limit: 2000,
    limitLabel: '본문 기준 장수에 따라 600~1,100자',
  },
  {
    id: 'instagram',
    name: '인스타그램',
    icon: 'instagram',
    hint: '첫 두 줄 후킹 · 해시태그 · 카드뉴스 연계',
    limit: 700,
    limitLabel: '권장 400~500자',
  },
  {
    id: 'threads',
    name: '쓰레드',
    icon: 'thread',
    hint: '짧은 대화체 · 300자 제한 · 질문형 마무리',
    limit: 300,
    limitLabel: '최대 300자',
  },
];
