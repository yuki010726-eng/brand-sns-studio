/** 게시 채널 정의. */
export const CHANNELS = [
  {
    id: 'blog',
    name: '블로그',
    icon: 'blog',
    hint: '검색 유입 중심 · 주제에 필요한 만큼 작성 + 이미지 + 캡션',
    // 블로그는 주제와 제안서의 정보량에 따라 필요한 만큼 쓴다. 채널 글자 수 상한을 두지 않는다.
    limit: null,
    limitLabel: '글자 수 제한 없음',
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
