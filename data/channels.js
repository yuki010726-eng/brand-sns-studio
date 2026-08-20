/** 게시 채널 정의. */
export const CHANNELS = [
  {
    id: 'blog',
    name: '블로그',
    icon: 'blog',
    hint: '검색 유입 중심 · 본문 1,400~2,000자 + 이미지 + 캡션',
    // ⚠️ limit 은 **전체** 글자 수 안전망이다(📷·캡션·표·태그 포함). 본문 목표는 그 절반쯤이다.
    //    본문 상한을 1,100 → 2,000 으로 올리면서(2026-08-20) 전체 상한도 같이 올렸다.
    limit: 3600,
    limitLabel: '본문 기준 1,400~2,000자 · 카드 장수와 무관',
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
