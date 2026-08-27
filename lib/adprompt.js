/**
 * 직관형(D) — **카드가 아니라 이미지 프롬프트를 만든다.**
 *
 * A·B·C 는 캔버스가 배경 위에 글자를 얹는 템플릿이다. 직관형은 그게 아니다.
 * 요청자가 준 레퍼런스(바탕화면 `concept_직관형` 9장)는 **글자까지 이미지 안에 들어가 있는**
 * 한국형 성과 광고 배너다 — 말풍선 후킹 · 극태 헤드라인 · 큰 숫자 · 체크리스트 · 하단 CTA 바가
 * 한 장에 다 있다. 캔버스로 흉내 낼 수 있는 배치가 아니라서 템플릿으로 만들지 않았다.
 *
 * ⚠️ **여기서는 `no text` 를 쓰지 않는다.** `lib/imageprompt.js` 는 정반대다 — 거기서는 글자를
 *    빼야 4단계에서 얹을 수 있고 생성된 한글이 깨지기 때문이다. 직관형은 글자가 그림의 절반이라
 *    **한글을 그릴 수 있는 모델**에서 써야 한다. 화면에서 그렇게 안내한다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ **2026-08-20 전면 개편 — 처음 만든 방식이 틀렸다.**
 *
 * 처음에는 레퍼런스 9장에서 배치 4종·색 3종을 뽑아 **장마다 돌려 썼다.** 의도는
 * "여러 장을 뽑아도 한 벌로 보이지 않게"였는데, 그게 정확히 거꾸로였다. 요청자 지적:
 * "이미 만들어진 이미지를 재활용하는 느낌이야. 하나의 컨셉으로 만들면 그 주제에서 생성되는
 *  카드뉴스의 컨셉은 통일 시켜줘."
 *
 * 원인이 둘이었다.
 *   ① **`card.shot` 을 한 번도 안 썼다.** 덱에는 아웃라인이 주제에 맞춰 지은 영문 장면이
 *      들어 있는데(`lib/outline.js` 3단계) 그걸 버리고 내 고정 배치 문구만 넣었다.
 *      그래서 주제를 바꿔도 그림에 찍히는 것이 안 바뀌었다 — '재활용' 은 이 얘기다.
 *   ② **배치·색을 장마다 돌렸다.** 카드뉴스는 한 벌로 읽혀야 하는데 6장이 6개의 다른 광고가 됐다.
 *
 * 지금 구조는 축이 둘로 갈라져 있다.
 *   **컨셉(고정)** — 인물·색·화풍. 주제 하나에 하나. 전 장이 공유한다.
 *   **장면(가변)** — 그 카드가 말하는 것. `card.shot` 과 카드 문구에서 나온다.
 *
 * ⚠️ 이 둘을 다시 섞지 말 것. 컨셉을 장마다 돌리면 ②로 돌아가고,
 *    장면을 고정하면 ①로 돌아간다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ **2026-08-28 — 여러 장을 버리고 완결된 한 장만 만든다.**
 *
 * 요청자 지적: "4장을 요구하면 1·2장은 내용에 충실해 좋았는데 나머지는 아쉬웠다.
 * 하나의 컨셉에서 제대로 된 1장만 나오게 하고 싶다."
 *
 * 뒷장이 무너진 원인이 둘이었다.
 *   ① **재료가 표지에 몰려 있었다.** 말풍선·큰 숫자는 `cover` 에만, 체크리스트는
 *      `cover`·`outro` 에만 붙었다. 본문 카드에 남는 건 헤드라인 두 줄 + 보조 한 줄 + CTA 뿐인데,
 *      CTA 는 한 벌에서 같은 값이라 3·4번은 「같은 바 + 같은 틀 + 글자만 바뀐 그림」이 됐다.
 *   ② **본문의 주인공이 `card.shot` 이었다.** 그건 아웃라인이 A·B·C **실사 사진**을 위해 지은
 *      영문 장면이다(`lib/outline.js` 3단계). 표지는 인물이 커서 가려지지만 본문은 그 장면이
 *      화면을 차지해 어긋남이 그대로 드러났다.
 *
 * 그래서 **역할(cover·body·note·outro)을 없앴다.** 직관형은 카드뉴스가 아니라 단독 광고 배너다 —
 * 레퍼런스 9장이 전부 한 장으로 완결된 배너이고, 원래 그 성격이었다.
 *
 * 지금은 **덱 전체를 재료로 보고 가장 센 것만 골라 한 장에 담는다.**
 * 후킹은 어느 카드에서든, 숫자는 덱 본문과 상품 자료 어디에서든, 체크리스트는 상품 특전에서.
 *
 * ⚠️ 장수 선택을 여기에 되살리지 말 것. 되살리는 순간 ①이 그대로 돌아온다 —
 *    재료는 한 벌 분량뿐인데 장수만 늘리면 뒷장은 남은 것으로 채워질 수밖에 없다.
 */

/**
 * 컨셉 — **주제 하나에 하나만 고른다.** 전 장이 같은 인물·같은 색·같은 화풍을 쓴다.
 *
 * `cast` 는 이미지 모델이 매 장 같은 사람을 그리게 하는 근거다. 그래서 **얼굴·머리·옷을
 * 구체적으로** 적는다 — "웃는 한국 여성" 처럼 두루뭉술하면 장마다 다른 사람이 나온다.
 *
 * ⚠️ `cast` 에서 나이·성별·의상 중 하나라도 빼지 말 것. 이 셋이 인물 동일성을 잡는 축이다.
 */
export const AD_CONCEPTS = [
  {
    id: 'woman-yellow',
    name: '웃는 여성 모델',
    who: '20대 여성이 손짓하며 말을 거는 사진',
    when: '처음 알리는 글 · 눈길을 끌어야 할 때',
    swatch: ['#FCF6E8', '#FFD400', '#E8214A'],
    person: true,
    cast: 'a Korean woman in her late twenties, dark brown hair pulled into a loose bun with soft bangs, warm open smile with visible teeth, wearing a mustard-yellow ribbed knit sweater, raising one index finger in an explaining gesture',
    palette: 'background warm cream #FCF6E8, primary yellow #FFD400, alert red #E8214A, deep black bars and pills #111111, body text near-black #111111',
    art: 'photographic cut-out of the model composited onto flat vector graphics, crisp cut edges, one soft radiating burst behind her, small hand-drawn sparkle and motion marks',
    // ⚠️ 이 구도는 요청자가 통과시킨 것이다 (2026-08-28). 나머지 넷을 고칠 때 여기를 건드리지 말 것.
    frame: [
      'a rounded speech-bubble hook sits at the top left, tilted slightly, with a thick outline and a small tail',
      'below it the headline is the largest element on the card and fills the left 60% of the frame, stacked in two lines',
      'a dashed-outline rounded box sits under the headline and holds the number line, with the digits far larger than the words around them',
      'the model sits on the right side, waist-up and prominent, overlapping the headline block slightly so the card reads as one piece',
      'a row of short check items with round check marks sits across the lower area, above the bottom bar',
    ],
    prop: 'as one flat graphic prop next to the model',
  },
  {
    id: 'man-navy',
    name: '정장 남성 모델',
    who: '30대 남성이 차분하게 설명하는 사진',
    when: '숫자·근거로 믿음을 줘야 할 때',
    swatch: ['#FFFFFF', '#16305C', '#FFC81E'],
    person: true,
    cast: 'a Korean man in his late thirties, short neatly-parted black hair, calm confident half-smile, wearing a white dress shirt under a navy blazer with no tie, one open palm presenting toward the text',
    palette: 'background off-white #FFFFFF, primary deep navy #16305C, highlight yellow #FFC81E, alert red #E23A2E, body text near-black #14181F',
    art: 'photographic cut-out of the model composited onto flat vector graphics with thin navy rule lines, crisp cut edges, hand-painted circular badge shapes',
    /**
     * ⚠️ **2026-08-28 재작성 — 「짜집기」로 나왔다** (요청자 지적:
     *    "레이아웃부터 하나의 컨셉이 아닌 그냥 짜집기 해놓음").
     *
     * 1판은 장치를 **다섯 개 따로** 세웠다 — 얇은 룰 라인 · 각진 네이비 블록 · 가로 네이비 밴드 ·
     * 둥근 흰 카드 · 작게 붙은 소품. 하나하나는 말이 되는데 서로 아무 관계가 없어서
     * **각자 다른 디자인에서 오려 붙인 것처럼** 보였다.
     *
     * 지금은 **판을 하나만 세운다.** 왼쪽에 딥네이비 리포트 패널 한 장을 놓고
     * 말풍선·헤드라인·보조·숫자·체크를 **전부 그 안에** 넣는다. 오른쪽에는 인물만 선다.
     * 요소가 한 판 위에 정렬되면 짜집기가 사라진다 — 신뢰 톤은 정렬에서 나온다.
     *
     * ⚠️ **패널 밖에 글자 요소를 새로 만들지 말 것.** 하나라도 밖에 나가면 1판으로 돌아간다.
     * ⚠️ 점선 박스(A의 장치)를 쓰지 않는다. 점선은 들뜬 느낌이라 신뢰 톤과 안 맞는다.
     */
    frame: [
      'one single deep navy rounded report panel stands on the left and fills about 62% of the width, running from near the top edge down to just above the bottom bar — every text element belongs inside this one panel and nothing textual floats outside it',
      'the speech-bubble hook sits astride the top edge of the panel, half on it and half above it, in white with a navy outline',
      'the headline sits inside the panel in two stacked lines in white, with only its key words in the highlight color, no boxes drawn around the words',
      'the number line sits inside the panel in a solid highlight-color band, its digits far larger than the words beside them',
      'the check items are listed inside the panel under that band, one per row in white, each with a small highlight-color circular check mark',
      'the model stands outside the panel on the right, in a three-quarter view from the waist up, turned toward the panel with one open palm presenting it',
    ],
    prop: 'as one object held in the model\'s free hand, close to the body and clearly part of the photograph rather than a sticker placed on top',
  },
  {
    id: 'duo-cartoon',
    name: '두 사람 만화',
    who: '고민하는 사람과 알려주는 사람 그림',
    when: '「이런 고민 → 이렇게 해결」 구성',
    swatch: ['#FAF3E3', '#FFD84D', '#9AA0A6'],
    person: true,
    cast: 'two Korean cartoon characters — a worried office worker in a grey shirt with round glasses, and a cheerful advisor in a yellow cardigan holding a clipboard',
    palette: 'background warm cream #FAF3E3, desaturated grey #9AA0A6 for the problem side, bright yellow #FFD84D for the solution side, alert red #E8391F, text near-black #111111',
    art: 'clean flat cartoon illustration, thick even outlines, simple cel shading, no photographic elements anywhere',
    /**
     * ⭐ 좌우 분할 구도 — **이 컨셉의 정체성이다** (2026-08-28, 요청자 지적).
     *
     * 예전에는 다섯 컨셉이 같은 구도를 써서 `the model sits on the right side, waist-up` 이 붙었다.
     * 그런데 `cast` 는 인물이 **둘**이다. 단수 문장이라 둘이 오른쪽에 겹쳐 서거나 한 명만 그려졌고,
     * 「이런 고민 → 이렇게 해결」이라는 이 컨셉의 짜임이 통째로 사라졌다.
     *
     * ⚠️ **왼쪽 = 문제(회색) · 오른쪽 = 해결(노랑)** 을 지우지 말 것. `palette` 가 그 둘을 전제로 쓰여 있다
     *    (`desaturated grey … for the problem side, bright yellow … for the solution side`).
     * ⚠️ 헤드라인은 **양쪽에 걸쳐** 한 덩어리로 둔다. 반으로 나누면 카드가 두 장으로 보인다.
     */
    /**
     * ⚠️ **2026-08-28 — 분할이 헤드라인까지 갈랐다** (요청자 지적:
     *    "좌우분할은 좋지만 상단의 텍스트까지 색깔이 분리되니 난해함").
     *
     * 1판은 헤드라인을 「양쪽에 걸쳐」로만 두고 배경 분할을 위에서 아래까지 그었다.
     * 그러니 글자가 회색 면과 노란 면에 걸치면서 **낱말마다 색이 갈렸다** —
     * 「브랜드」는 검정, 「어워즈」는 빨강. 읽는 순서가 끊긴다.
     *
     * **분할은 헤드라인 아래에서 시작한다.** 상단은 좌우를 덮는 단색 밴드가 가져가고,
     * 헤드라인은 그 밴드 안에서 **한 가지 색**으로 간다. 강조는 색이 아니라 낱말 하나에만 준다.
     *
     * ⚠️ **왼쪽 = 문제(회색) · 오른쪽 = 해결(노랑)** 을 지우지 말 것. `palette` 가 그 둘을 전제로 쓰여 있다.
     * ⚠️ 분할선을 상단 밴드까지 올리지 말 것. 올리는 순간 1판의 문제가 그대로 돌아온다.
     */
    frame: [
      'a solid dark band spans the full width across the top quarter of the card and sits on top of everything behind it, so the split never reaches the top of the frame',
      'the headline sits inside that band in two stacked lines, all of it in one single light color with only one key word in the accent color — the headline colour must not change from side to side',
      'below the band the frame is split vertically down the middle into a muted grey left half and a bright yellow right half',
      'the worried character stands in the lower left of the muted half with the speech-bubble hook above their head',
      'a thick arrow crosses the middle from the muted side into the bright side, overlapping both halves',
      'the cheerful advisor stands in the lower right of the bright half, and the number line sits above them inside a rounded burst shape on the bright side only, its digits far larger than the words around them',
      'the check items are stacked vertically down the bright side under the number line, each with a round check mark',
    ],
    prop: 'as one flat graphic prop held up by the cheerful advisor on the bright right half',
  },
  {
    id: 'scene-real',
    name: '매장 사진',
    who: '사람 없이 매장·사무실 실제 사진',
    when: '제품이나 현장을 보여줄 때',
    swatch: ['#EFE7DC', '#16305C', '#FFC81E'],
    person: false,
    /**
     * ⚠️ **2026-08-28 — 배경이 주제와 상관없는 카페로 나왔다** (요청자 지적:
     *    "배경과 상관 없고 트로피 하나 올려놓는 거로 부족함").
     *
     * 원인은 여기였다. 1판 `cast` 가 `pale wood counter, white subway tile, black pendant lights,
     * a few potted plants` 로 **집기를 못박아** 어떤 주제를 넣어도 늘 같은 카페가 나왔다.
     * 그 방은 그냥 예쁜 배경이지 주제를 말하지 않는다.
     *
     * 이제 방의 **종류를 고정하지 않고**, 광고가 말하는 것이 그 방에 이미 자리잡고 있어야
     * 한다고 적는다. 방이 주제를 말하는 것이 이 컨셉의 존재 이유다.
     *
     * ⚠️ 특정 업종의 집기 목록을 다시 못박지 말 것 — 그 순간 모든 주제가 그 업종으로 간다.
     *    (`MAGAZINE_IMAGE_PROMPT.md` 5절 ①의 「집기만 적고 장소를 비우면 집으로 간다」와 짝인 실패다)
     */
    cast: 'no people in frame; a real Korean small-business interior in even daylight, and the room itself must be about what the ad says — whatever the headline is talking about is already installed and in use in this room, not merely decorated around',
    palette: 'natural warm photo tones, deep navy #16305C panels and bars, highlight yellow #FFC81E, text near-black #14181F on white cards',
    art: 'realistic interior photograph as the background with flat vector text panels, brush-stroke shapes, and rounded white cards composited on top',
    /**
     * 사진 위 오버레이 구도 — 이 컨셉만 **배경이 사진**이다.
     *
     * ⚠️ 다른 넷처럼 「소품을 오른쪽에 크게」로 두면 안 된다. 배경이 이미 방 전체라,
     *    소품이 따로 떠 있으면 사진 위에 스티커를 붙인 것처럼 보인다.
     *    **사진 안의 가구 위에 실제로 놓인 것처럼** 둔다.
     * ⚠️ 글자는 사진 위에 그냥 얹지 않는다. 반투명 패널·흰 카드가 받쳐야 읽힌다.
     */
    frame: [
      'the photographic interior fills the entire frame as the background, edge to edge',
      'a semi-transparent deep navy panel covers the upper left area, and the headline sits inside it in two stacked lines with its key words in the highlight color',
      'the speech-bubble hook sits above that panel, overlapping its top edge',
      'the number line sits inside a hand-painted yellow circular badge in the upper right corner, its digits far larger than the words around them',
      'the check items sit side by side in three equal columns inside one rounded white card pinned across the lower area, each column with a small icon above its line',
    ],
    /**
     * ⚠️ **소품 하나로는 모자란다** (2026-08-28). 1판은 트로피 한 개를 카운터에 올렸는데,
     *    그러니 「이 매장이 받았다」가 아니라 「어디선가 트로피를 가져다 놨다」로 보였다.
     *    **같은 것을 세 자리에 나눠 두면** 그 방의 주인이 실제로 그것을 쓰고 있다는 뜻이 된다.
     */
    prop: 'not as one object but spread through the room in three separate places at once — mounted on the wall behind, standing on the counter, and applied to the glass or door — all of them real objects lit by the same daylight, so the room reads as a business that actually earned them',
  },
  {
    id: 'icon-flat',
    name: '아이콘 그림',
    who: '사람 없이 아이콘과 도형만',
    when: '절차·항목을 정리해 보여줄 때',
    swatch: ['#FAF3E3', '#1F7A45', '#FFD84D'],
    person: false,
    cast: 'no people and no photographs anywhere; flat vector icons with rounded 2px strokes, solid fills, and a consistent 8px corner radius',
    palette: 'background cream #FAF3E3, primary deep green #1F7A45, alert red #E8391F, highlight yellow #FFD84D, text near-black #111111',
    art: 'pure flat vector graphic design, no photographs, no gradients, generous white space, simple geometric shapes',
    /**
     * 가로 밴드 + 3칸 그리드 구도 — 「절차·항목을 정리해 보여줄 때」 쓰는 컨셉이다.
     *
     * ⚠️ **인물이 없으므로 좌우로 나누지 않는다.** 다른 넷은 오른쪽에 인물이 서서 왼쪽 60%가
     *    글자 자리가 되는데, 여기서 그 배치를 쓰면 오른쪽 절반이 통째로 빈다.
     *    위아래 밴드로 쌓고 **가운데를 아이콘 3칸이 채운다** — 그게 항목 정리라는 성격에도 맞는다.
     */
    frame: [
      'no photographs and no person anywhere, so the whole card is built as stacked horizontal bands rather than a left-right split',
      'a rounded outlined speech-bubble hook sits at the top center',
      'the headline sits under it, centered, in two stacked lines, its key words set inside solid rounded blocks',
      'the number line sits in a thick solid band running the full width directly under the headline, its digits far larger than the words beside them',
      'three equal square panels sit side by side across the middle of the frame, each holding one large simple icon above one short check item line',
    ],
    prop: 'as the single largest icon, filling the centre panel of the three',
  },
];

export const DEFAULT_AD_CONCEPT = AD_CONCEPTS[0].id;
export const getAdConcept = (id) => AD_CONCEPTS.find((c) => c.id === id) || AD_CONCEPTS[0];

/**
 * 톤앤매너 → 컨셉 (2026-08-21, 요청자 지시: "톤앤매너 선택에서 ~형에 따라 알맞은 스타일이
 * 직관형에 적용되도록").
 *
 * 1단계에서 이미 고른 것으로 정한다 — **같은 것을 두 번 고르게 하지 않는다.**
 * 8-31 ②에서 장수를 1단계로 넘긴 것과 같은 판단이다.
 *
 * | 톤 | 컨셉 | 왜 |
 * |---|---|---|
 * | trust 신뢰·정보형 | 정장 남성 | 숫자·근거로 믿음을 주는 자리 |
 * | hook 후킹·공감형 | 두 사람 만화 | 「이런 고민 → 이렇게 해결」이 곧 후킹 구성 |
 * | plain 담백·실무형 | 아이콘 그림 | 절차·항목만 남긴다. 인물이 없어야 요점이 산다 |
 * | celebrate 축하·발표형 | 웃는 여성 | 소식을 밝게 전하는 자리 |
 *
 * ⚠️ 매장 사진(`scene-real`)은 어느 톤에도 안 걸린다 — **고르는 사람이 직접 바꿀 때만** 쓴다.
 *    톤이 넷인데 컨셉이 다섯이라 그렇다. 톤을 늘리지 말고 이 표에 억지로 끼워 넣지도 말 것.
 */
const AD_CONCEPT_BY_TONE = {
  trust: 'man-navy',
  hook: 'duo-cartoon',
  plain: 'icon-flat',
  celebrate: 'woman-yellow',
};

/** 이 톤에 맞는 컨셉 id. 모르는 톤이면 기본값. */
export const adConceptForTone = (tone) => AD_CONCEPT_BY_TONE[tone] || DEFAULT_AD_CONCEPT;

/**
 * 배너 한 장의 구도 — **컨셉마다 다르다.** 각 컨셉의 `frame` 에 있다.
 *
 * ⚠️ **2026-08-28 — 구도를 하나로 묶었다가 되돌렸다.** 요청자 지적:
 *    "1번 밝은 여성을 제외하면 다 너무 매력 없고 별로야. 각 형마다 특징과 분위기를 살려
 *     레이아웃을 다르게 하든 해서 수정해줘."
 *
 *    맞는 지적이다. 한 구도가 다섯을 눌렀다. 가장 크게 드러난 것이 두 사람 만화(C)로,
 *    인물이 둘인데 `the model sits on the right side, waist-up` 이라는 **단수 문장**이 붙어
 *    「이런 고민 → 이렇게 해결」이라는 짜임이 통째로 사라졌다.
 *
 * | 컨셉 | 구도 |
 * |---|---|
 * | `woman-yellow` | 좌 60% 글자 + 우측 인물 + 점선 숫자 박스 (요청자 통과 · 건드리지 말 것) |
 * | `man-navy` | 룰 라인 · 각진 네이비 블록 · 세로 흰 카드 — 문서처럼 |
 * | `duo-cartoon` | **좌우 분할** — 왼쪽 회색(문제) / 오른쪽 노랑(해결), 가운데 화살표 |
 * | `scene-real` | 사진 전면 배경 + 반투명 패널 · 원형 배지 · 하단 3칸 흰 카드 |
 * | `icon-flat` | 인물 없음 → 좌우로 안 나누고 **가로 밴드 + 아이콘 3칸 그리드** |
 *
 * ⚠️ **다시 하나로 합치지 말 것.** 합치는 순간 C 의 좌우 분할과 D 의 사진 배경이 먼저 죽는다.
 * ⚠️ 위치를 「왼쪽 60%」처럼 못박아 둔다. 안 적으면 모델이 글자를 가운데 모아
 *    포스터처럼 그린다 — 성과 광고 배너로 안 읽힌다.
 */
const FRAME_TAIL = [
  // 다섯 컨셉이 공유하는 유일한 줄이다. 레퍼런스 9장이 전부 이 하단 바를 갖고 있다.
  'a full-width solid CTA bar is pinned to the very bottom edge, with a circular icon on the left and a circular arrow button on the right',
];

/**
 * ⚠️ **장수를 여기서 고르지 않는다** (2026-08-20, 요청자 지시: "직관형은 왜 8장이야?
 *    상품 주제에서 선택되도록 해줘"). 장수는 1단계 「카드뉴스 장수」(`state.cardCount`) 하나가 정하고,
 *    직관형은 덱 길이를 그대로 쓴다.
 *
 * 이렇게 하면 **덱과 장수가 어긋날 일이 없어진다** — 앞서 있던 '내용이 모자라 반복된다',
 * '뒤 항목이 빠진다' 문제가 통째로 사라진다. 선택지를 두 곳에 두지 말 것.
 */

/* ---------------- 문구 뽑기 ---------------- */

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();

/**
 * 상한을 넘으면 **어절 경계에서** 끊는다.
 *
 * ⚠️ **글자 수로 그냥 자르지 말 것.** 이 프로젝트가 같은 자리에서 두 번 데였다 —
 *    8-11 의 `trimWords()`, 8-25 의 「중앙일보 연합광고와 포브스…」. 여기 문구는
 *    **광고 이미지에 큰 글씨로 박히는** 것이라 어절 중간에서 끊기면 그대로 사고다.
 */
function trimWords(text, max) {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return at > 0 ? t.slice(0, at) : t;
}

/** 문장 하나만 — 카드 본문은 여러 문장이라 그대로 넣으면 헤드라인이 안 된다 */
function firstSentence(text, max = 34) {
  const one = clean(text).split(/(?:[.!?…])\s|\n/)[0] || '';
  return trimWords(one.replace(/[.]+$/, ''), max);
}

/**
 * 헤드라인을 두 줄로 나눈다 — 레퍼런스는 전부 2~3줄 스택이다.
 * 띄어쓰기 기준으로 **가운데에 가장 가까운 자리**에서 끊는다. 한 덩어리면 그대로 한 줄이다.
 */
function twoLines(text, max = 26) {
  const t = trimWords(text, max * 2);
  const words = t.split(' ');
  if (words.length < 2) return [t, ''];
  const half = t.length / 2;
  let best = 1;
  let bestGap = Infinity;
  let run = 0;
  words.forEach((w, i) => {
    run += w.length + 1;
    if (i === words.length - 1) return;
    const gap = Math.abs(run - half);
    if (gap < bestGap) { bestGap = gap; best = i + 1; }
  });
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const NUMBER_MAX = 32;
const BULLET_MAX = 16;
const CTA_MAX = 26;
const HOOK_MAX = 14;
const CTA_FALLBACK = '지금 문의하고 시작하세요';

/**
 * 숫자가 들어간 근거 한 줄. 레퍼런스의 「1건당 40~80만원」 자리다.
 *
 * ⚠️ **지어내지 않는다.** 상품 자료(`facts`)나 그 카드 본문에 숫자가 있으면 그것을 쓰고,
 *    없으면 이 줄을 통째로 비운다. 광고 이미지에 큰 글씨로 찍히는 숫자라 틀리면 그대로 사고다.
 * ⚠️ **통째로 들어가는 것만 쓴다.** 어절 경계에서 끊어도 「심사 배점 1,000점 중 고객만족도가」
 *    같은 조각이 남는데, 이 줄은 그림에서 가장 큰 글씨라 조각이면 바로 눈에 띈다.
 */
function numberLine(product, deck, exclude = '') {
  const hasNum = /\d/;
  /**
   * ⚠️ **덱 한 장이 아니라 덱 전체를 훑는다** (2026-08-28). 예전에는 표지 카드 하나만 봐서,
   *    숫자가 3번 카드에 있으면 그 줄이 통째로 비었다. 한 장만 만드는 지금은 그게 곧
   *    「근거 없는 배너」다 — 재료가 어디 있든 찾아 쓴다.
   *
   * ⚠️ **보조 문구로 이미 쓴 문장은 건너뛴다** (`exclude`). 둘 다 표지 카드 본문에서 나오므로
   *    안 막으면 **같은 문장이 큰 숫자 자리와 보조 문구 자리에 두 번 찍힌다** — 실측에서 걸렸다.
   *    건너뛰면 다음 후보(대개 상품 자료의 배점·기간)가 올라와 숫자 줄다워진다.
   */
  const same = (a, b) => normalizeLine(a) === normalizeLine(b);
  const fromDeck = deck
    .flatMap((c) => clean(c && c.body).split(/(?:[.!?])\s|\n/))
    .find((x) => hasNum.test(x) && !same(x, exclude));
  const fromFacts = (product.facts || [])
    .find((x) => hasNum.test(String(x)) && !same(x, exclude));
  const fits = [fromDeck, fromFacts].map(clean).filter((x) => x && x.length <= NUMBER_MAX);
  return fits[0] || '';
}

/** 문장 끝 마침표만 다른 것을 같은 문장으로 본다 — `firstSentence()` 가 마침표를 떼기 때문이다 */
const normalizeLine = (v) => clean(v).replace(/[.!?…]+$/, '');

/**
 * 체크 리스트 — 칸에 통째로 들어가는 특전만.
 * ⚠️ 표지·마무리에만 넣는다. 본문 카드까지 같은 목록을 반복하면 장마다 같은 그림이 된다.
 */
const bulletsOf = (product) => (product.benefits || [])
  .map(clean).filter((x) => x && x.length <= BULLET_MAX).slice(0, 3);

/**
 * 하단 바 문구 — 승인된 CTA 목록에서 고른다.
 *
 * ⚠️ **자르지 않는다.** 승인된 CTA 는 23~32자인데(8-25) 하단 바에 들어가는 길이는 그보다 짧다.
 *    어절 경계에서 끊어도 「…프로필 링크에서」처럼 **동사가 날아간 조각**이 남는다.
 *    통째로 들어가는 것만 쓰고, 없으면 행동 안내 한 줄로 넘긴다.
 * ⚠️ **한 벌 안에서는 같은 문구를 쓴다.** 장마다 다른 CTA 가 뜨면 한 벌로 안 읽힌다.
 */
function ctaOf(product) {
  const fits = (product.voice && product.voice.ctas ? product.voice.ctas : [])
    .map(clean).filter((x) => x && x.length <= CTA_MAX);
  return fits[0] || CTA_FALLBACK;
}

/**
 * 말풍선 후킹 — 말풍선에 통째로 들어가는 것만. 없으면 브랜드 짧은 이름.
 *
 * ⚠️ 상품 소구점(`appeals`)을 **덱 제목보다 먼저** 본다 (2026-08-28). 말풍선은 스크롤을
 *    멈춰 세우는 자리라 「무슨 항목인가」보다 「왜 봐야 하나」가 와야 한다. 덱 제목은
 *    헤드라인이 이미 쓰고 있어서, 여기까지 제목이 오면 같은 말이 두 번 찍힌다.
 */
function hookOf(product, deck) {
  const pool = [...(product.appeals || []), ...deck.map((c) => c && c.title)]
    .map(clean).filter((x) => x && x.length <= HOOK_MAX);
  return pool[0] || clean(product.short);
}

/**
 * 이 카드가 **무엇을 보여주는지** — 주제에서 나온다.
 *
 * ⚠️ 여기가 개편의 핵심이다. `card.shot` 은 아웃라인이 그 항목을 보고 지은 영문 장면이라
 *    주제가 바뀌면 같이 바뀐다. 이걸 안 쓰면 그림이 고정 배치 문구만 따라가서
 *    **주제와 무관한 같은 그림**이 나온다 (8-20 ②와 같은 실패다).
 */
function subjectOf(deck, topic, where) {
  const shot = clean((deck.find((c) => c && c.shot) || {}).shot);
  /**
   * ⚠️ **`shot` 을 그대로 넣지 않는다** (2026-08-28). 그건 아웃라인이 A·B·C **실사 사진**을 위해
   *    지은 장면 묘사다 — 조명·심도·카메라 각도까지 들어 있다. 플랫 벡터 광고 배너에 통째로
   *    넣으면 결이 어긋난 사진 장면이 화면 한복판에 들어앉는다. 뒷장이 무너졌던 원인 ②다.
   *
   *    그래서 **장면에서 사물 하나만 뽑아 납작한 소품으로 그리라고** 감싼다.
   *    감싸는 문장이 없으면 모델은 장면 전체를 그린다.
   */
  if (shot) {
    return 'take the single most important object from this scene description and draw it'
      + ` ${where} — do not draw the scene itself, no photographic`
      + ` background, no depth of field, no camera angle from it: "${shot}"`;
  }
  // 아웃라인이 없는 경로(규칙 기반·옛 보관본)에서는 주제라도 넘긴다.
  const fallback = clean((deck[0] && deck[0].title) || topic);
  return fallback
    ? `${where}, representing: "${fallback}"`
    : '';
}

/*
 * `roleAt()` · `cardAt()` 는 지웠다 (2026-08-28).
 *
 * 장수만큼 장을 만들고 **몇 번째 장인지로 역할을 정하던** 함수들이다. 한 장만 만드는 지금은
 * 정할 역할이 없다 — 그 한 장이 표지이자 본문이자 마무리다.
 *
 * ⚠️ 「덱보다 적게 뽑을 때 앞에서부터 자르면 뒤 항목이 빠진다」는 `cardAt()` 의 교훈은
 *    **여기서도 살아 있다.** 지금은 덱을 골라 쓰는 대신 **전부 훑어 재료를 모은다**
 *    (`numberLine` · `hookOf` · `bulletsOf`). 어느 쪽이든 덱 앞부분만 보면 뒤가 통째로 버려진다.
 */



/* ---------------- 프롬프트 ---------------- */

/**
 * @param {{product:object, topic:string, deck:Array, conceptId:string}} ctx
 * @returns {Array<{n:number, role:string, concept:object, copy:object, prompt:string}>}
 */
export function buildAdPrompts({ product, topic, deck = [], conceptId }) {
  const concept = getAdConcept(conceptId);
  const head = deck[0] || null;

  const [line1, line2] = twoLines((head && head.title) || topic);
  const sub = firstSentence((head && head.body) || topic, 30);
  const copy = {
    hook: hookOf(product, deck),
    line1,
    line2,
    sub,
    number: numberLine(product, deck, sub),   // 보조 문구와 같은 문장이 두 번 찍히지 않게
    bullets: bulletsOf(product),
    cta: ctaOf(product),
    hashtags: (product.hashtags || []).slice(0, 4).map((x) => clean(x)),
  };

  /**
   * ⚠️ **배열로 돌려주는 것은 그대로 둔다.** 화면(`pages/template.js`)이 `map()` 으로 그리고
   *    `adPrompts.find()` 로 복사 버튼을 찾는다. 길이만 1이 됐을 뿐 다루는 방법은 안 바뀐다.
   *    `n` 과 `role` 도 화면이 읽으므로 남긴다.
   */
  return [{
    n: 1,
    role: 'single',
    concept,
    copy,
    prompt: promptOf({ product, concept, copy, subject: subjectOf(deck, topic, concept.prop) }),
  }];
}

/**
 * ⚠️ 역할이 하나뿐이라 표는 지웠지만 **함수는 남긴다** — `pages/template.js` 가 import 한다.
 *    옛 보관본에 `cover`·`outro` 가 남아 있을 수 있어 그것도 받아 준다.
 */
const ROLE_LABEL = { single: '광고 배너', cover: '표지', body: '본문', note: '반론', outro: '마무리' };
export const roleLabel = (role) => ROLE_LABEL[role] || '광고 배너';

/**
 * 프롬프트 한 벌.
 *
 * 지시는 영문, **찍을 글자는 한글 그대로** 따옴표에 넣는다. 번역하라고 두면 모델이 뜻만 살려
 * 제 마음대로 다시 쓴다 — 승인되지 않은 말이 광고에 찍힌다.
 *
 * ⚠️ **`SERIES` 절을 빼지 말 것.** 이미지 모델은 한 장씩 따로 그리므로, 같은 벌이라고
 *    말해 주지 않으면 장마다 다른 사람·다른 색이 나온다. 인물 동일성은 이 절이 잡는다.
 */
function promptOf({ product, concept, copy, subject }) {
  /**
   * ⚠️ **해시태그는 그림에 넣지 않는다** (2026-08-28). 예전에는 마무리 카드에만 붙였는데,
   *    한 장짜리가 된 지금 그것까지 넣으면 글자 층이 여섯이 되어 배너가 빽빽해진다.
   *    해시태그는 원래 캡션에 쓰는 것이라 `copy.hashtags` 는 화면·보관용으로 남겨 둔다.
   */
  const lines = [
    copy.hook && `speech bubble hook: "${copy.hook}"`,
    copy.line1 && `headline line 1: "${copy.line1}"`,
    copy.line2 && `headline line 2: "${copy.line2}"`,
    copy.sub && `supporting line: "${copy.sub}"`,
    copy.number && `big number line: "${copy.number}"`,
    copy.bullets.length ? `check list items: ${copy.bullets.map((b) => `"${b}"`).join(' / ')}` : '',
    copy.cta && `bottom CTA bar: "${copy.cta}"`,
  ].filter(Boolean).map((line) => `  - ${line}`).join('\n');

  return [
    'Create ONE brand-new square 1:1 Korean direct-response social ad card from this description alone.',
    /**
     * ⚠️ **한 번에 한 장이다** (2026-08-21, 요청자 지적: "4장이 1장에 4컷으로 나뉘어 나온다").
     *    프롬프트를 여러 개 한꺼번에 붙여 넣으면 모델이 그걸 **한 장 안의 여러 칸**으로 읽는다.
     *    화면의 「모두 복사」도 따로 생성하라고 머리말에 적지만, **프롬프트 자체가 막아야** 확실하다.
     *    ⚠️ 이 줄을 지우지 말 것 — 지우면 4장이 다시 4분할 한 장으로 나온다.
     */
    'Output a SINGLE full-bleed card that fills the entire frame. This is not a grid, not a collage,'
      + ' not a multi-panel layout, and not a set of thumbnails — do not divide the canvas into sections'
      + ' and do not draw more than one card in the image.',
    /**
     * ⚠️ **참조할 그림이 있다고 말하지 않는다** (2026-08-21, 요청자 지적).
     *    예전에는 `SERIES: … keep them identical across the set` · `SUBJECT (identical on every card)`
     *    처럼 **다른 그림을 가리키는 말**로 통일을 지시했다. 그런데 그 그림은 존재하지 않는다.
     *    그래서 모델이 "기준이 될 캐릭터를 주세요" 라고 되묻거나 **이미지 편집 작업으로 오해**했다.
     *
     *    통일은 참조로 잡는 게 아니라 **묘사로 잡는다.** 인물·색·화풍을 매 장 똑같은 문장으로
     *    적어 두면 따로 그려도 같은 그림이 나온다 — 그게 `cast`·`palette`·`art` 가 있는 이유다.
     *    ⚠️ `cast` 에 「the same … throughout」 같은 말을 다시 넣지 말 것. 그 순간 참조 요구가 된다.
     */
    'This is a text-to-image request. No reference image is provided and none is needed —'
      + ' do not ask for one, and do not treat this as editing an existing image.',
    /**
     * ⚠️ **한 장으로 완결된다고 못박는다** (2026-08-28). 예전 「N장 중 몇 번째」 줄을 지운 자리다.
     *    그 줄이 없으면 모델이 "이어지는 카드가 있겠거니" 하고 여백을 남기거나
     *    「다음 장에서 계속」 같은 빈 자리를 만든다. 이어질 것이 없다고 말해 줘야 다 채운다.
     */
    'This is a stand-alone ad. It is not part of a series, nothing comes before or after it,'
      + ' and it must work completely on its own — do not leave room for a follow-up card'
      + ' and do not imply that the message continues elsewhere.',
    `SUBJECT: ${concept.cast}`,
    `SUPPORTING GRAPHIC: ${subject}`,
    `LAYOUT: ${[...concept.frame, ...FRAME_TAIL].join(', ')}`,
    `COLOR PALETTE: ${concept.palette}`,
    `STYLE: ${concept.art}`,
    'typography: extra-bold rounded Korean gothic (heavy weight), thick white outline and a soft drop shadow on the largest lines, one key word per line filled with the accent color, numbers set far larger than the surrounding words',
    /**
     * ⚠️ 크기 서열을 글로 못박는다 (2026-08-28). 층이 여섯이라 안 적으면 모델이 전부
     *    비슷한 크기로 그려서 「글자만 많은 카드」가 된다. 광고 배너는 서열이 곧 후킹이다.
     */
    'size order, largest first: the headline, then the number line, then the speech bubble, then the check items, then the supporting line',
    'generous margins, everything inside a safe area away from the edges, no empty dead space anywhere',
    ...(concept.person ? ['all people are Korean with East Asian faces, styled for a South Korean audience'] : []),
    '',
    'RENDER THIS KOREAN TEXT EXACTLY AS WRITTEN, character for character, and no other words anywhere in the image:',
    lines,
    '',
    `brand handle in small type at a corner: "${clean(product.handle || product.short)}"`,
    'negative: no English sentences, no invented text, no garbled or misspelled Hangul, no watermark, no stock-photo logo, no extra taglines beyond the list above, no request for a reference image, no blank placeholder frames, no grid, no collage, no split screen, no multiple cards in one image, no border frames around the card',
  ].join('\n');
}

/* ---------------- 컨셉 미리보기 ---------------- */

/**
 * 컨셉 썸네일 (SVG) — **말로 설명하는 대신 보여 준다** (2026-08-21, 요청자 요구:
 * "아무리 말로 설명해줘도 이미지로 작게라도 보여주는 게 좋을 것 같아").
 *
 * ⚠️ **실제 생성 이미지가 아니라 배치·색 견본이다.** 뽑히는 그림은 주제마다 달라지므로
 *    고정 이미지를 박아 두면 그게 곧 8-30 에서 고친 「재활용처럼 보인다」로 돌아간다.
 *    여기서 보여 주는 것은 **그 컨셉이 늘 지키는 것** — 색 세 개, 인물이 나오는지,
 *    말풍선·헤드라인·CTA 바가 어디에 앉는지다. 그건 `woman-yellow` 의 `frame` 과 실제로 같다.
 *
 * ⚠️ 파일이 아니라 **코드로 그린다.** 컨셉을 고치면 견본이 저절로 따라오고,
 *    저장소에 이미지가 쌓이지 않으며, 오프라인에서도 뜬다.
 *
 * @param {object} c   `AD_CONCEPTS` 의 한 항목
 * @param {{size?:number, id?:string}} [opts] `id` 는 clipPath 가 화면에서 겹치지 않게 하는 접두어
 * @returns {string} `<svg>` 문자열 (그대로 innerHTML 에 넣는다)
 */
export function adThumbSvg(c, { size = 120, id = '' } = {}) {
  const [bg, key, alert] = c.swatch;
  const ink = '#111111';
  const uid = `adt-${id || c.id}`;
  // 인물이 없는 컨셉은 사람 자리에 '보여 줄 물건'이 들어간다 — 실제 배치도 그렇다.
  const subject = c.person
    ? `<circle cx="76" cy="41" r="12" fill="${ink}" opacity=".85" />
       <path d="M58 74c0-11 8-19 18-19s18 8 18 19z" fill="${ink}" opacity=".85" />`
    : `<rect x="58" y="34" width="36" height="30" rx="4" fill="${ink}" opacity=".18" />
       <circle cx="68" cy="45" r="4" fill="${ink}" opacity=".55" />
       <path d="M60 62l10-11 8 8 6-5 8 8z" fill="${ink}" opacity=".55" />`;
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img"
         aria-label="${esc(c.name)} 배치와 색 견본" focusable="false">
      <clipPath id="${uid}"><rect width="100" height="100" rx="6" /></clipPath>
      <g clip-path="url(#${uid})">
        <rect width="100" height="100" fill="${bg}" />
        <circle cx="18" cy="30" r="26" fill="${key}" opacity=".55" />
        ${subject}
        <rect x="8" y="16" width="30" height="10" rx="5" fill="#FFFFFF" stroke="${ink}" stroke-width="1.5" />
        <rect x="8" y="34" width="42" height="7" rx="1.5" fill="${ink}" />
        <rect x="8" y="45" width="34" height="7" rx="1.5" fill="${key}" />
        <rect x="8" y="56" width="26" height="4" rx="1.5" fill="${ink}" opacity=".45" />
        <rect x="8" y="66" width="30" height="6" rx="3" fill="${alert}" />
        <rect y="84" width="100" height="16" fill="${ink}" />
        <circle cx="10" cy="92" r="4" fill="${key}" />
        <rect x="20" y="89" width="52" height="6" rx="3" fill="#FFFFFF" opacity=".9" />
        <circle cx="90" cy="92" r="5" fill="${key}" />
      </g>
    </svg>`;
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
