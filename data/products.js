/**
 * 4개 상품 기준 정보
 * 출처: 바탕화면/07_BRAND_INFORMATION.md (기준일 2026-07-23)
 * 게시 시점에 일정·접수 상태·금액은 공식 자료로 다시 확인해야 한다.
 */

/** @typedef {'kbsn'|'forbes'|'kcst'|'aitvcf'} ProductId */

export const PRODUCTS = [
  {
    id: 'kbsn',
    name: 'KBS N 브랜드어워즈',
    short: 'KBS N',
    icon: 'award',
    handle: '@kbsnawards_official',
    tagline: '방송사 최초 브랜드어워즈',
    summary: 'KBS N과 주식회사 오픈엑스가 공동 진행하는 브랜드 시상식. 연중 상시 접수이며 2026년 시상식은 12월 18일 상암 스탠포드호텔에서 열립니다.',
    intake: '연중 상시 접수',
    site: 'https://kbsnawards.com/',
    facts: [
      '2026년 시상식 예정일 · 2026.12.18',
      '예정 장소 · 상암 스탠포드호텔',
      '수상기업 수 · 2023년 108개 / 2024년 139개',
    ],
    benefits: ['엠블럼 5종', '인증서', '시상식 참석', '수상 기사', 'KBS N 홈페이지 게재', '인터뷰 영상'],
    packages: [
      { name: '패키지 1', desc: 'KBS 드라마 자막광고 형태의 슈퍼자막 (약 2~3초 노출)' },
      { name: '패키지 2', desc: '15초 AI 홍보영상' },
    ],
    appeals: ['KBS 공신력', '방송사 최초', 'TV 노출', '브랜드 신뢰 강화', '제3자 인증'],
    cautions: [
      '기본 특전과 추가 패키지를 구분해서 표현',
      '수상만으로 매출이 상승한다고 단정하지 않음',
      '공식 근거 없이 최고·유일·1위 표현을 사용하지 않음',
    ],
    /** 마무리 문장 — 공통 사실성 원칙의 '권장 표현'만 사용한다 */
    closings: [
      '수상 이력은 고객이 브랜드를 판단할 때 신뢰 근거로 활용될 수 있습니다.',
      '브랜드의 품질과 경쟁력을 객관적으로 보여주는 자료가 될 수 있습니다.',
    ],
    hashtags: ['KBSN브랜드어워즈', '브랜드어워즈', '기업인증', '브랜드신뢰도', 'KBSN'],
    /**
     * SNS용 화법 재료 — 불릿을 나열하는 대신 이 문장들을 조합해 글을 만든다.
     * hooks 는 톤 순서(신뢰/후킹/담백/축하)에 맞춰 4개를 둔다.
     */
    voice: {
      hooks: [
        '2024년 한 해에만 139개 기업이 이 상을 받았습니다.',
        '"수상 이력, 그래서 어디에 쓰나요?"',
        '올해 시상식은 12월 18일, 상암입니다.',
        '📢 2026 KBS N 브랜드어워즈, 접수 진행 중입니다.',
      ],
      /** 블로그 소제목용 — 질문과 답을 반드시 쌍으로 둔다 (따로 뽑으면 서로 어긋난다) */
      qa: [
        { q: 'KBS N 브랜드어워즈는 어떤 상인가요?',
          a: '방송사가 직접 여는 브랜드어워즈로, KBS N과 주식회사 오픈엑스가 함께 진행합니다. 2023년에는 108개, 2024년에는 139개 기업이 수상했습니다.',
          shot: 'a modern television broadcast control room, rows of glowing monitors, blue ambient light' },
        { q: '수상하면 무엇을 받게 되나요?',
          a: '엠블럼 5종과 인증서, 시상식 참석, 수상 기사, KBS N 홈페이지 게재, 인터뷰 영상이 기본 특전으로 제공됩니다.',
          shot: 'an award certificate and a polished metal emblem badge arranged on a dark wooden desk, soft window light' },
        { q: '추가 패키지는 뭐가 다른가요?',
          a: '기본 특전과는 별개입니다. KBS 드라마 자막광고 형태의 슈퍼자막을 약 2~3초 노출하는 패키지 1, 15초 AI 홍보영상을 만드는 패키지 2가 있습니다.',
          shot: 'a living room television playing a drama scene in a dim evening room, glowing screen' },
        { q: '시상식은 언제, 어디서 열리나요?',
          a: '2026년 시상식은 12월 18일 상암 스탠포드호텔에서 열릴 예정입니다. 접수는 연중 상시라 지금 준비를 시작해도 늦지 않습니다.',
          shot: 'an elegant hotel banquet hall prepared for an evening awards ceremony, round tables and stage lighting' },
        { q: '받은 다음에는 어디에 쓰나요?',
          a: '엠블럼과 인증서는 제품 패키지나 상세페이지, 명함, 매장 게시물에 들어갑니다. 수상 기사와 인터뷰 영상은 브랜드 소개 자료로 이어서 활용할 수 있습니다.',
          shot: 'a product package box and business cards laid out on a clean studio table, soft shadows' },
      ],
      /** 표지·반론·마무리 카드의 장면 (영문 — 이미지 생성 프롬프트에 그대로 들어간다) */
      shots: {
        cover: 'a grand awards ceremony stage in a broadcast hall, warm golden spotlights, silhouetted audience, empty podium',
        note: 'a small business owner sitting alone at a desk late at night, laptop glow on their face, thoughtful',
        outro: 'a shop entrance at dusk with a framed certification plaque mounted beside the door',
      },
      proof: [
        '방송사가 직접 여는 브랜드어워즈로, KBS N과 주식회사 오픈엑스가 함께 진행합니다.',
        '심사를 통과하면 엠블럼 5종과 인증서, 수상 기사, KBS N 홈페이지 게재, 인터뷰 영상까지 함께 제공됩니다.',
        '접수는 연중 상시라 지금 준비를 시작해도 늦지 않습니다.',
        '2023년에는 108개, 2024년에는 139개 기업이 수상했습니다.',
        '원하면 KBS 드라마 슈퍼자막(약 2~3초)이나 15초 AI 홍보영상을 추가 패키지로 붙일 수 있습니다.',
        '2026년 시상식은 12월 18일 상암 스탠포드호텔에서 열립니다.',
      ],
      objection: '상을 받는다고 매출이 오르지는 않습니다. 다만 고객이 브랜드를 판단할 때 참고할 근거가 하나 늘어납니다.',
      ctas: [
        '접수 조건은 프로필 링크에서 확인하실 수 있습니다.',
        '우리 업종이 해당되는지 궁금하면 DM 주세요.',
        '준비 서류가 궁금하신 분은 댓글 남겨주세요.',
      ],
      /**
       * 쓰레드 전용 화법 — 공지가 아니라 '알게 된 걸 흘리는' 톤.
       * opens 는 톤 순서(신뢰/후킹/담백/축하)에 맞춰 4개.
       */
      threads: {
        opens: [
          '요즘 브랜드 인증 뭐가 있나 보다가 알게 된 건데요.',
          '이건 좀 의외였어요.',
          '연말에 몰리는 이유가 있더라고요.',
          '아는 분이 먼저 하고 알려주셔서 정리해 둡니다.',
        ],
        notes: [
          '방송사가 직접 여는 브랜드어워즈가 있더라고요. KBS N이랑 오픈엑스가 같이 하는 거라고.',
          '작년에만 139개 기업이 받았대요. 재작년은 108개였고.',
          '접수가 연중 상시라 시기 눈치 안 봐도 되는 게 편해 보이더라고요.',
          '엠블럼이랑 인증서만 주는 줄 알았는데 수상 기사에 인터뷰 영상까지 나온다고.',
          '원하면 KBS 드라마 자막광고에 2~3초 붙이는 것도 따로 있더라고요.',
          '올해 시상식은 12월 18일 상암이라고 합니다.',
        ],
        hedge: '물론 상 받는다고 매출이 뛰고 그러진 않죠. 고객이 판단할 때 볼 근거가 하나 생기는 정도.',
        closes: [
          '이런 거 챙기시는 분들 있을 것 같아서 적어둡니다.',
          '연말 정리하실 때 참고만 하세요.',
          '필요한 분들만 보시면 될 것 같아요.',
        ],
      },
    },
    topicPresets: [
      '2026 시상식 일정 안내 (12월 18일)',
      '기본 특전 6종 한눈에 정리',
      '슈퍼자막 패키지가 뭔가요',
      '수상 이력을 홍보에 활용하는 법',
    ],
  },
  {
    id: 'forbes',
    name: '포브스 브랜드어워즈',
    short: '포브스',
    icon: 'star',
    handle: '@forbesawards_openx',
    tagline: '중앙일보 주최 · 포브스코리아 주관',
    summary: '1,000점 기준 심사로 진행되며, 수상 시 중앙일보 연합광고와 포브스 특집 게재, 관련 포럼 초대가 이어집니다. 행사별로 일정과 분야가 다릅니다.',
    intake: '행사별 개별 접수',
    site: '',
    facts: [
      '1,000점 기준 심사',
      '수상 시 중앙일보 연합광고',
      '포브스 특집 게재 · 관련 포럼 초대',
    ],
    /** 기준일(2026-07-23) 이후 일정만 '접수 가능'으로 표시 */
    events: [
      { code: 'A', name: '대한민국 신뢰받는 혁신대상', date: '2026-09-29', status: 'open',
        desc: '기술 혁신 · 품질 혁신 · 서비스 혁신 · 공공 혁신' },
      { code: 'B', name: '소비자선정 최고의 브랜드 대상', date: '2026-02-27', status: 'closed',
        desc: '6개 카테고리 · JTBC 후원' },
      { code: 'C', name: '고객신뢰도 1위 프리미엄 브랜드 대상', date: '2026-10-30', status: 'open',
        desc: '4개 부문 · JTBC 후원' },
      { code: 'D', name: '대한상공회의소·포브스 사회공헌대상', date: '2026-05-27', status: 'closed',
        desc: '제17회 · ESG와 사회공헌 중심' },
    ],
    benefits: ['중앙일보 연합광고', '포브스 특집 게재', '관련 포럼 초대'],
    packages: [],
    appeals: ['포브스 브랜드 권위', '중앙일보 보도', '기관 후원', 'ESG', '기업 신뢰도', '언론 활용'],
    cautions: [
      '공식 근거 없이 "대한민국 최고 권위"라고 단정하지 않음',
      '종료된 행사를 현재 접수 중인 것처럼 표현하지 않음',
      '행사별 주최·주관·후원기관을 혼동하지 않음',
    ],
    closings: [
      '수상 이력은 고객이 브랜드를 판단할 때 신뢰 근거로 활용될 수 있습니다.',
      '업종과 브랜드 상황에 따라 적합한 활용 방식이 달라질 수 있습니다.',
    ],
    hashtags: ['포브스브랜드어워즈', '포브스코리아', '중앙일보', 'ESG경영', '기업인증'],
    voice: {
      hooks: [
        '1,000점 만점으로 심사합니다.',
        '"포브스 어워즈는 큰 기업만 받는 거 아닌가요?"',
        '올해 남은 일정은 두 개입니다. 9월 29일, 그리고 10월 30일.',
        '📢 하반기 포브스 브랜드어워즈 일정을 안내드립니다.',
      ],
      qa: [
        { q: '올해 남은 행사는 무엇인가요?',
          a: '9월 29일 대한민국 신뢰받는 혁신대상, 10월 30일 고객신뢰도 1위 프리미엄 브랜드 대상 두 개가 남아 있습니다.',
          shot: 'a desk calendar with two dates circled in red ink, a fountain pen resting beside it, morning light' },
        { q: '심사는 어떻게 진행되나요?',
          a: '1,000점을 기준으로 심사합니다. 중앙일보가 주최하고 포브스코리아가 주관합니다.',
          shot: 'a panel of judges reviewing documents around a long conference table, large windows, natural light' },
        { q: '수상하면 무엇이 이어지나요?',
          a: '중앙일보 연합광고와 포브스 특집 게재, 관련 포럼 초대가 이어집니다.',
          shot: 'a newspaper spread and an open business magazine side by side on a marble table' },
        { q: '행사마다 뭐가 다른가요?',
          a: '혁신대상은 기술·품질·서비스·공공 네 갈래로 나뉘고, 프리미엄 브랜드 대상은 4개 부문이며 JTBC가 후원합니다. 주최·주관·후원 기관이 행사마다 다르니 구분해서 보셔야 합니다.',
          shot: 'four separate spotlights illuminating four empty pedestals in a dark exhibition hall' },
        { q: '우리 업종도 해당되나요?',
          a: '행사별로 대상 분야가 정해져 있습니다. 혁신대상은 기술·품질·서비스·공공 영역을, 프리미엄 브랜드 대상은 소비자 접점이 있는 브랜드를 중심으로 봅니다.',
          shot: 'business people from several different industries standing together in a bright modern lobby' },
      ],
      shots: {
        cover: 'stacked business magazines on a marble table beside a window overlooking a city skyline, editorial still life',
        note: 'a business person standing at a tall window holding a document, weighing a decision, backlit',
        outro: 'an award trophy on a desk beside an open business magazine, evening city lights through the window',
      },
      proof: [
        '중앙일보가 주최하고 포브스코리아가 주관합니다.',
        '심사는 1,000점을 기준으로 진행됩니다.',
        '9월 29일 대한민국 신뢰받는 혁신대상은 기술·품질·서비스·공공 네 갈래로 나뉩니다.',
        '10월 30일 고객신뢰도 1위 프리미엄 브랜드 대상은 4개 부문이며 JTBC가 후원합니다.',
        '수상하면 중앙일보 연합광고와 포브스 특집 게재, 관련 포럼 초대가 이어집니다.',
      ],
      objection: '권위를 말로 설명하기보다, 주최·주관과 심사 기준을 직접 확인해 보시는 편이 빠릅니다. 행사마다 일정과 대상 분야가 다르니 구분해서 보셔야 합니다.',
      ctas: [
        '행사별 접수 일정은 프로필 링크에서 확인하실 수 있습니다.',
        '어느 행사가 맞을지 궁금하면 DM 주세요.',
        '부문 구분이 헷갈리시면 댓글로 물어보셔도 됩니다.',
      ],
      threads: {
        opens: [
          '남은 일정 찾아보다가 정리하게 됐어요.',
          '포브스 어워즈가 하나인 줄 알았는데 아니더라고요.',
          '심사 방식이 생각보다 구체적이던데요.',
          '이건 헷갈리는 분들 많을 것 같아서 남겨둡니다.',
        ],
        notes: [
          '중앙일보가 주최하고 포브스코리아가 주관하는 구조더라고요.',
          '1,000점 기준으로 심사한다고 합니다.',
          '올해 남은 건 9월 29일이랑 10월 30일, 두 개예요.',
          '9월 건 기술·품질·서비스·공공으로 나뉘고, 10월 건은 4개 부문에 JTBC 후원이라고.',
          '수상하면 중앙일보 연합광고랑 포브스 특집까지 이어진다고 하더라고요.',
        ],
        hedge: '행사마다 주최랑 후원이 다 달라서, 이름만 보고 같은 거라고 생각하면 헷갈리기 쉬워요.',
        closes: [
          '알아보시는 분들 참고하시라고 적어둡니다.',
          '둘 중에 뭐가 맞을지는 업종 보고 판단하셔야 할 것 같아요.',
          '저도 정리하면서 알게 된 부분이라 남겨둡니다.',
        ],
      },
    },
    topicPresets: [
      '신뢰받는 혁신대상 9월 29일 안내',
      '프리미엄 브랜드 대상 4개 부문 소개',
      '1,000점 심사 기준은 어떻게 되나요',
      '수상 후 언론 노출 활용법',
    ],
  },
  {
    id: 'kcst',
    name: 'KCST 대한민국 고객만족도 신뢰도 대상',
    short: 'KCST',
    icon: 'shield',
    handle: '@kcstawards_official',
    tagline: '전 업종 신청 가능 · 연중 상시 접수',
    summary: '소상공인과 중소기업도 접근할 수 있는 구조이며 비대면 시상이 가능합니다. 매장과 온라인 채널에서 바로 쓰는 인증물이 함께 제공됩니다.',
    intake: '연중 상시 접수',
    site: '',
    facts: [
      '전 업종 신청 가능',
      '비대면 시상 가능',
      '소상공인·중소기업 친화 구조',
    ],
    /** 심사 기준 — 합계 100% 를 정확히 유지할 것 */
    criteria: [
      { label: '고객만족도', weight: 30 },
      { label: '브랜드 신뢰도', weight: 25 },
      { label: '품질', weight: 20 },
      { label: '시장 반응', weight: 15 },
      { label: '사회적 책임', weight: 10 },
    ],
    benefits: ['상장', '상패', '인증서', '네이버 플레이스 배너', 'X배너', '메탈 현판', '언론 기사 배포'],
    packages: [],
    appeals: ['전 업종 참여', '연중 상시 접수', '소상공인 친화', '매장·온라인 활용 인증물'],
    cautions: [
      '"저비용"을 구체적인 금액 근거 없이 과장하지 않음',
      '언론 매체 수를 쓸 경우 최신 공식 자료 확인',
      '심사 기준의 합계와 비율을 정확하게 유지',
    ],
    closings: [
      '고객 신뢰와 브랜드 품질을 보여주는 객관적 근거로 활용될 수 있습니다.',
      '업종과 브랜드 상황에 따라 적합한 활용 방식이 달라질 수 있습니다.',
    ],
    hashtags: ['KCST', '고객만족도대상', '소상공인', '브랜드신뢰도', '기업인증'],
    voice: {
      hooks: [
        '심사 항목 중 고객만족도가 30%를 차지합니다.',
        '"소상공인도 신청할 수 있나요?" — 전 업종 가능합니다.',
        '연중 상시 접수, 비대면 시상도 됩니다.',
        '📢 KCST 대한민국 고객만족도 신뢰도 대상, 상시 접수 중입니다.',
      ],
      qa: [
        { q: '어떤 기준으로 심사하나요?',
          a: '고객만족도 30%, 브랜드 신뢰도 25%, 품질 20%, 시장 반응 15%, 사회적 책임 10%로 심사합니다.',
          shot: 'a clipboard with a checklist and a pen on a clean desk, soft daylight from the side' },
        { q: '무엇을 받게 되나요?',
          a: '상장과 상패, 인증서에 더해 네이버 플레이스 배너, X배너, 메탈 현판이 나옵니다. 언론 기사 배포도 특전에 포함됩니다.',
          shot: 'a metal certification plaque, a rolled certificate and a standing banner arranged inside a small shop' },
        { q: '작은 매장도 신청할 수 있나요?',
          a: '전 업종이 신청할 수 있습니다. 심사가 매출 규모가 아니라 고객만족도와 브랜드 신뢰도 중심이라 소상공인도 접근할 수 있는 구조입니다.',
          shot: 'a small cafe storefront on a quiet neighborhood street, warm interior lights, welcoming' },
        { q: '시상식에 꼭 가야 하나요?',
          a: '비대면 시상이 가능합니다. 일정을 비우기 어려운 곳도 참여할 수 있습니다.',
          shot: 'a laptop on a shop counter showing a video call, small store interior blurred behind' },
        { q: '받은 다음에는 어디에 쓰나요?',
          a: '메탈 현판은 매장 입구에, X배너는 상담 공간이나 행사장에 둡니다. 네이버 플레이스 배너는 손님이 온라인에서 가게를 찾을 때 바로 보입니다.',
          shot: 'a shop entrance with a certification plaque beside the door and a smartphone held up showing a map listing' },
      ],
      shots: {
        cover: 'a warm neighborhood shop interior at golden hour, owner smiling behind the counter, inviting atmosphere',
        note: 'a small shop owner standing outside their storefront with arms crossed, looking at the sign, thinking',
        outro: 'a bright shop entrance with a certification plaque beside the door, a customer walking in',
      },
      proof: [
        '고객만족도 30%, 브랜드 신뢰도 25%, 품질 20%, 시장 반응 15%, 사회적 책임 10%로 심사합니다.',
        '전 업종이 신청할 수 있고 접수는 연중 상시로 열려 있습니다.',
        '수상하면 상장과 상패, 인증서에 더해 네이버 플레이스 배너와 X배너, 메탈 현판이 함께 나옵니다.',
        '언론 기사 배포도 특전에 포함됩니다.',
        '비대면 시상이 가능해 일정을 비우기 어려운 곳도 참여할 수 있습니다.',
      ],
      objection: '규모가 작으면 어렵지 않을까 걱정하시는 경우가 많습니다. 심사는 매출 규모가 아니라 고객만족도와 브랜드 신뢰도 중심으로 이뤄집니다.',
      ctas: [
        '신청 절차는 프로필 링크에서 보실 수 있습니다.',
        '우리 업종이 되는지 궁금하면 DM 주세요.',
        '현판·배너 실물이 궁금하시면 댓글 남겨주세요.',
      ],
      threads: {
        opens: [
          '심사 기준 보고 좀 놀랐어요.',
          '작은 가게 하시는 분들이 의외로 모르시더라고요.',
          '이건 생각보다 문턱이 낮았습니다.',
          '매장에 걸 만한 게 없나 찾다가 봤는데요.',
        ],
        notes: [
          '심사에서 고객만족도가 30%로 제일 크더라고요. 그다음이 브랜드 신뢰도 25%.',
          '전 업종이 신청 가능하고, 접수도 연중 상시로 열려 있더라고요.',
          '비대면 시상도 된다고 해서 일정 부담은 덜하겠다 싶었어요.',
          '상장이랑 상패만 주는 게 아니라 메탈 현판, X배너, 네이버 플레이스 배너까지 나온다고.',
          '언론 기사 배포도 포함이라고 하더라고요.',
        ],
        hedge: '싸다고 말하긴 좀 그렇고요. 다만 매출 규모로 거르는 구조가 아니라는 게 포인트인 것 같아요.',
        closes: [
          '동네에서 장사하시는 분들 참고하시면 좋을 것 같아 남깁니다.',
          '플레이스 배너 하나만 봐도 나쁘지 않더라고요.',
          '필요하신 분들만 보세요.',
        ],
      },
    },
    topicPresets: [
      '심사 기준 5가지 비중 공개',
      '특전 7종 정리 (현판·배너 포함)',
      '소상공인도 신청할 수 있나요',
      '네이버 플레이스 배너 활용법',
    ],
  },
  {
    id: 'aitvcf',
    name: '중소기업 AI TV CF',
    short: 'AI TV CF',
    icon: 'tv',
    handle: '@aitvcf_official',
    tagline: '우리 브랜드도 TV에 나옵니다',
    summary: 'AI 기반 CF 제작부터 IPTV 송출까지 연결되는 상품입니다. IPTV 3사 기반 채널을 운영하며 지역 타겟팅과 완전 시청 기준 과금 방식을 활용할 수 있습니다.',
    intake: '상담 후 진행',
    site: '',
    facts: [
      'AI 기반 CF 제작 지원',
      'IPTV 3사 기반 채널 운영',
      '지역 타겟팅 · 완전 시청 기준 과금 방식 활용 가능',
    ],
    benefits: ['AI 기반 CF 제작 지원', '언론 보도', '브랜드대상 연계 혜택', 'IPTV 광고 송출'],
    packages: [],
    appeals: ['TV 매체 신뢰도', '제작비 부담 완화', '지역 단위 타겟 광고', '온라인 광고와 다른 신뢰 접점'],
    targets: [
      '지역 인지도를 높이고 싶은 브랜드',
      '신제품 또는 매장 오픈을 알리고 싶은 기업',
      '온라인 광고 이외의 접점이 필요한 브랜드',
      '영상 제작과 송출을 함께 진행하고 싶은 기업',
    ],
    cautions: [
      "'300만 원' 표현은 제작비·지원금·실결제 중 무엇인지 공식 자료 확인 후 사용",
      '광고 성과를 무조건 보장하지 않음',
      '전국 송출과 지역 타겟 송출을 혼동하지 않음',
    ],
    closings: [
      'AI 기반 제작과 IPTV 송출을 통해 기존보다 접근 가능한 TV 광고 방식을 검토할 수 있습니다.',
      '업종과 브랜드 상황에 따라 적합한 활용 방식이 달라질 수 있습니다.',
    ],
    hashtags: ['중소기업광고', 'AITVCF', 'IPTV광고', 'TV광고', '지역광고'],
    voice: {
      hooks: [
        '우리 브랜드도 TV에 나옵니다.',
        '"TV 광고는 대기업만 하는 거 아닌가요?"',
        '광고를 지역만 골라서 내보낼 수 있습니다.',
        '📢 중소기업 AI TV CF, 제작부터 송출까지 안내드립니다.',
      ],
      qa: [
        { q: 'AI로 만든 CF는 어떻게 나오나요?',
          a: 'AI 기반으로 CF를 제작하고 그대로 IPTV 송출까지 연결됩니다. 제작 업체와 송출 매체를 따로 알아보지 않아도 됩니다.',
          shot: 'a video editing workspace, wide monitor showing a timeline, warm studio lighting' },
        { q: '어디에 송출되나요?',
          a: 'IPTV 3사 기반 채널을 통해 송출됩니다. 채널 수와 송출 범위는 상품 조건에 따라 달라지니 최신 자료를 확인해 주세요.',
          shot: 'three television screens side by side in a dark room, each showing a different broadcast' },
        { q: '지역만 골라서 틀 수 있나요?',
          a: '지역 단위 타겟팅이 가능합니다. 다만 전국 송출과 지역 타겟 송출은 조건이 다르니 어느 쪽인지 확인하고 진행하셔야 합니다.',
          shot: 'an aerial night view of a city district, glowing streets forming a map-like pattern' },
        { q: '광고비는 어떻게 계산되나요?',
          a: '완전 시청을 기준으로 과금하는 방식을 활용할 수 있습니다. 구체적인 금액과 조건은 상품 자료에서 확인해 주세요.',
          shot: 'a desk with a calculator and an open notebook, a small television glowing in the background' },
        { q: '어떤 브랜드에 맞나요?',
          a: '지역 인지도를 높이려는 브랜드, 신제품이나 매장 오픈을 알리려는 기업, 온라인 광고 외에 다른 접점이 필요한 곳에서 주로 검토합니다.',
          shot: 'a newly opened store with a grand opening ribbon across the entrance, bright daylight' },
      ],
      shots: {
        cover: 'a living room television glowing in a dim room playing a commercial, family silhouettes on the sofa',
        note: 'a small business owner watching television alone in a quiet shop after closing hours',
        outro: 'a storefront sign glowing at night, a television screen visible through the shop window',
      },
      proof: [
        'AI로 CF를 만들고 IPTV로 내보내는 과정이 하나로 연결됩니다.',
        'IPTV 3사 기반 채널을 운영하고 있어 지역 단위 타겟팅이 가능합니다.',
        '완전 시청을 기준으로 과금하는 방식을 활용할 수 있습니다.',
        '언론 보도와 브랜드대상 연계 혜택도 함께 제공됩니다.',
        '신제품을 알리거나 매장을 새로 여는 시점에 검토하는 경우가 많습니다.',
      ],
      objection: '광고를 튼다고 성과가 보장되지는 않습니다. 다만 온라인 광고와는 성격이 다른 신뢰 접점을 하나 더 만드는 방법으로 검토해 볼 수 있습니다.',
      ctas: [
        '송출 범위와 조건은 프로필 링크에서 확인해 주세요.',
        '우리 지역이 되는지 궁금하면 DM 주세요.',
        '업종별 심의 가능 여부는 댓글로 문의 주세요.',
      ],
      threads: {
        opens: [
          '광고비 계산 방식이 생각보다 합리적이던데요.',
          'TV 광고는 아직도 대기업만 하는 건 줄 알았는데요.',
          '지역만 골라서 튼다는 게 좀 신기했어요.',
          '이거 모르시는 분들 꽤 많을 것 같아서 적어둡니다.',
        ],
        notes: [
          'AI로 CF 만들고 IPTV로 내보내는 걸 한 번에 해주더라고요.',
          'IPTV 3사 기반 채널이라 지역 단위로 골라서 송출된다고 합니다.',
          '완전 시청 기준으로 과금하는 방식도 쓸 수 있다고 하더라고요.',
          '제작 따로 송출 따로 알아볼 필요가 없는 게 제일 편해 보였어요.',
          '매장 새로 열거나 신제품 낼 때 많이들 본다고 하더라고요.',
        ],
        hedge: '물론 튼다고 바로 효과가 나오는 건 아니고요. 온라인 광고랑은 접점 성격이 다르다는 정도로 보시면 될 것 같아요.',
        closes: [
          '온라인 광고만 하다 지치신 분들 참고하시라고요.',
          '지역에서 장사하시는 분들한테 특히 맞을 것 같더라고요.',
          '필요한 분들만 챙겨가세요.',
        ],
      },
    },
    topicPresets: [
      '우리 브랜드도 TV에 나옵니다',
      'IPTV 지역 타겟팅이란',
      '완전 시청 기준 과금 방식 설명',
      '매장 오픈을 TV로 알리는 법',
    ],
  },
];

/** 공통 금지 표현 — 카피 작성 화면에서 경고로 노출한다 */
export const BANNED_PHRASES = [
  '수상하면 매출이 무조건 상승',
  '모든 기업이 반드시',
  '100% 보장',
  '가장 권위 있는',
  '신청만 하면 수상',
];

/** 채널 정의 — 2단계(아이디어 문서화)에서 사용 */
export const CHANNELS = [
  // 블로그는 '정확한 정보를 지루하지 않게' 전달하는 채널이라 분량이 필요하다.
  // 요약·근거·이미지 자리까지 넣으면 1,400자로는 모자라 요청자 요구(내용 보강)와 충돌했다.
  { id: 'blog', name: '블로그', icon: 'blog', hint: '검색 유입 중심 · 1,500~2,000자 · 소제목 + 이미지 자리 표시',
    limit: 2600, limitLabel: '권장 1,500~2,000자' },
  { id: 'instagram', name: '인스타그램', icon: 'instagram', hint: '첫 두 줄 후킹 · 해시태그 · 카드뉴스 연계',
    limit: 2200, limitLabel: '캡션 최대 2,200자' },
  { id: 'threads', name: '쓰레드', icon: 'thread', hint: '짧은 대화체 · 500자 제한 · 질문형 마무리',
    limit: 500, limitLabel: '최대 500자' },
];

/** @param {ProductId} id */
export const getProduct = (id) => PRODUCTS.find((p) => p.id === id) || null;
