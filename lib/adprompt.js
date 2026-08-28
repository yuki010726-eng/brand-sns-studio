/**
 * 광고형(D, 옛 이름 직관형) — **카드가 아니라 이미지 프롬프트를 만든다.**
 *
 * A·B·C 는 캔버스가 배경 위에 글자를 얹는 템플릿이다. 광고형은 그게 아니다.
 * 요청자가 준 레퍼런스(바탕화면 `concept_직관형` 9장)는 **글자까지 이미지 안에 들어가 있는**
 * 한국형 성과 광고 배너다 — 말풍선 후킹 · 극태 헤드라인 · 큰 숫자 · 체크리스트 · 하단 CTA 바가
 * 한 장에 다 있다. 캔버스로 흉내 낼 수 있는 배치가 아니라서 템플릿으로 만들지 않았다.
 *
 * ⚠️ **여기서는 `no text` 를 쓰지 않는다.** `lib/imageprompt.js` 는 정반대다 — 거기서는 글자를
 *    빼야 4단계에서 얹을 수 있고 생성된 한글이 깨지기 때문이다. 광고형은 글자가 그림의 절반이라
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
 * 그래서 **역할(cover·body·note·outro)을 없앴다.** 광고형은 카드뉴스가 아니라 단독 광고 배너다 —
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
 *
 * ⚠️ **`desc` 는 두 문장 · 50자 안쪽으로 쓴다** (2026-08-28 2판). 처음엔 120~165자로 썼는데
 *    고르는 화면의 설명 칸은 `who · when` 두 줄에 이어 붙는 자리라 그 길이가 안 들어간다.
 *    넷을 나란히 훑어 고르는 자리이므로 **길이와 짜임이 넷 다 같아야** 비교가 된다.
 *    짜임: 「무엇이 보이는가. 언제 안 맞는가(또는 무엇을 아끼는가).」
 * ⚠️ 두 번째 문장을 빼지 말 것. 「이건 좋다」만 있으면 넷 중 하나를 못 고른다.
 */
export const AD_CONCEPTS = [
  {
    id: 'woman-yellow',
    name: '여성 모델',
    who: '20대 여성이 손짓하며 말을 거는 사진',
    when: '처음 알리는 글 · 눈길을 끌어야 할 때',
    desc: '크림 바탕에 노랑·빨강, 반짝임으로 가장 밝게 갑니다. 무게가 필요한 내용은 남성 모델로.',
    swatch: ['#FCF6E8', '#FFD400', '#E8214A'],
    person: true,
    cast: 'a Korean woman in her late twenties, dark brown hair pulled into a loose bun with soft bangs, warm open smile with visible teeth, wearing a mustard-yellow ribbed knit sweater, raising one index finger in an explaining gesture',
    palette: 'background warm cream #FCF6E8, primary yellow #FFD400, alert red #E8214A, deep black bars and pills #111111, body text near-black #111111',
    art: 'the model drawn photo-realistically with crisp cut edges, standing over flat vector graphics, one soft radiating burst behind her, small hand-drawn sparkle and motion marks',
    // ⚠️ 이 구도는 요청자가 통과시킨 것이다 (2026-08-28). 나머지 셋을 고칠 때 여기를 건드리지 말 것.
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
    name: '남성 모델',
    who: '30대 남성이 차분하게 설명하는 사진',
    when: '숫자·근거로 믿음을 줘야 할 때',
    desc: '왼쪽 딥네이비 패널 한 장에 글자를 모읍니다. 노랑은 작은 강조에만 씁니다.',
    swatch: ['#FFFFFF', '#16305C', '#FFC81E'],
    person: true,
    cast: 'a Korean man in his late thirties, short neatly-parted black hair, calm confident half-smile, wearing a white dress shirt under a navy blazer with no tie, one open palm presenting toward the text',
    palette: 'background off-white #FFFFFF, primary deep navy #16305C, highlight yellow #FFC81E used only in small accents, alert red #E23A2E, body text near-black #14181F, the full-width bottom bar in deep navy #16305C with white lettering',
    /**
     * ⚠️ **2026-08-28 — A 의 느낌이 섞여 가벼워졌다** (요청자 지적: "이전 작업물은 배너에
     *    무게감이 느껴지고 남성의 느낌이 났는데 지금 왜 이렇게 가볍고 A의 느낌이 섞인것같아").
     *
     *    앞선 판에서 소품을 밝게 만들면서 **하이라이트(노랑)를 굵게 둘렀다.** 그 노랑이
     *    하단 CTA 바까지 번지고, 모델이 반짝임·속도선까지 얹으면서 A(웃는 여성)의 결이 됐다.
     *    A 는 크림·노랑에 반짝임이 정체성이고, B 는 **네이비 큰 면 + 정렬**이 정체성이다.
     *
     * ⚠️ **하이라이트는 작은 면에만 쓴다.** 큰 면(하단 바·패널)은 네이비다.
     *    반짝임·속도선·방사선을 여기에 넣지 말 것 — 그 셋이 A 의 표식이다.
     */
    art: 'the model drawn photo-realistically with crisp cut edges, standing over flat vector graphics with thin navy rule lines, hand-painted circular badge shapes, the whole card sober and restrained with every large area in deep navy or off-white and the highlight yellow kept to small accents only, no sparkles, no motion marks, no starbursts and no radiating rays anywhere',
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
    /**
     * ⚠️ **밝게 만든다** (2026-08-28, 요청자 지적: "어두운 남자 옷에 검은 화면은 아주 별로야").
     *    소품이 어두우면 남색 재킷과 붙어 **검은 덩어리 하나**로 뭉친다. 흰 본체·흰 화면에
     *    하이라이트 테두리를 둘러 인물에서 떼어 낸다. 대비는 색이 아니라 **밝기**에서 나온다.
     * ⚠️ 여기에 어두운 색을 다시 쓰지 말 것 — `palette` 의 네이비가 이미 인물 옷을 먹고 있다.
     */
    prop: 'as one object held in the model\'s free hand, close to the body, its casing and its'
      + ' screen both in white and pale grey with a thin navy outline and a soft drop shadow,'
      + ' bright enough to stay clearly separated from the dark navy blazer and never merging'
      + ' into it as a single dark shape',
  },
  {
    id: 'duo-cartoon',
    name: '만화 · 카툰',
    who: '고민하는 사람과 알려주는 사람 그림',
    when: '「이런 고민 → 이렇게 해결」 구성',
    desc: '아래를 회색·노랑으로 갈라 고민과 해결을 마주 세웁니다. 사진이 없어 광고 티가 덜 납니다.',
    swatch: ['#FAF3E3', '#FFD84D', '#9AA0A6'],
    person: true,
    cast: 'two Korean cartoon characters — a worried office worker in a grey shirt with round glasses, and a cheerful advisor in a yellow cardigan holding a clipboard',
    palette: 'background warm cream #FAF3E3, desaturated grey #9AA0A6 for the problem side, bright yellow #FFD84D for the solution side, alert red #E8391F, text near-black #111111',
    art: 'clean flat cartoon illustration, thick even outlines, simple cel shading, no photographic elements anywhere',
    /**
     * ⭐ 좌우 분할 구도 — **이 컨셉의 정체성이다** (2026-08-28, 요청자 지적).
     *
     * 예전에는 모든 컨셉이 같은 구도를 써서 `the model sits on the right side, waist-up` 이 붙었다.
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
    /**
     * ⚠️ **2026-08-28 — C 만 매번 「편집으로 잘못 인식」되던 원인** (요청자 지적:
     *    "왜 계속 C 두사람 만화는 지속적으로 이 문구가 뜨는거야?").
     *
     *    다섯 컨셉 중 **C 에만** 있던 것이 셋이었다. 낱말을 A·B·D·E 와 대조해 찾았다.
     *    ① `the frame is **split** vertically …` — `split` 을 **시키는 말**로 썼다. 다른 넷에서
     *       이 낱말은 `negative:` 안에만 있다. 게다가 같은 프롬프트가 `no split screen` 이라고도
     *       말해 **자기모순**이었다 — 쪼개라면서 쪼개지 말라고 한다.
     *    ② `sits on top of everything behind it` · `overlapping both halves` — 층을 쌓으라는
     *       **합성 어투**다. 그림을 묘사하는 말이 아니라 편집 작업을 가리킨다.
     *    ③ `the headline colour **must not** change` — 본문에 남은 유일한 명령형 부정이다.
     *       `do not` 은 걸러 냈는데 `must not` 이 빠져나갔다.
     *
     *    셋 다 걷어내고 **자리로만** 적는다. 좌우 두 면이라는 구도는 그대로다.
     *
     * ⚠️ `split`·`must not`·`on top of` 를 여기에 다시 쓰지 말 것. 구도는 「나눠라」가 아니라
     *    **「두 면이 가운데서 맞닿아 있다」**로 적는다. 같은 그림이 나오고 방아쇠는 사라진다.
     */
    frame: [
      'a solid dark band runs unbroken across the full width of the top quarter of the card, and the two coloured areas below begin only where that band ends',
      'the headline sits inside that band in two stacked lines, all of it in one single light colour with only one key word in the accent colour, the same colouring from the first letter to the last',
      'below the band the lower area is two halves side by side meeting at a straight vertical edge down the middle, the left half muted grey and the right half bright yellow',
      'the worried character stands in the lower left of the muted half with the speech-bubble hook above their head',
      'a thick arrow reaches across the middle from the muted side into the bright side, its tail on the grey and its point on the yellow',
      'the cheerful advisor stands in the lower right of the bright half, and the number line sits above them inside a rounded burst shape on the bright side only, its digits far larger than the words around them',
      'the check items are stacked one under another down the bright side below the number line, each with a round check mark',
    ],
    prop: 'as one flat graphic prop held up by the cheerful advisor on the bright right half',
  },
  /**
   * 3D 아이콘 — **2026-08-28 신설** (요청자 지시: "6,7번 이미지를 참고해서 「3D아이콘」으로
   * E의 이름을 명하며 이제 생성할떄 프롬프트 같이 생성해줘").
   *
   * 레퍼런스 2장의 공통점: 진한 그라데이션 배경 + 뒤에서 퍼지는 방사 글로우 + **광택 있는
   * 입체 오브젝트**(확성기·자명종) + 극태 헤드라인 + 하단 둥근 흰 카드.
   *
   * ⚠️ **2026-08-28 — 아이콘 그림(`icon-flat`)을 지웠다** (요청자 지시: "아이콘 형을 이제
   *    그만할려고해"). 납작한 아이콘 3칸으로 항목을 정리하던 컨셉인데, 살려 보려고 두 번
   *    고쳤는데도(입체감 복구 · 아이콘을 물건으로) 「매력 없는 디자인의 표본」이라는 판정을
   *    벗어나지 못했다. 인물 없는 자리는 3D 아이콘 하나가 맡는다.
   * ⚠️ 납작한 아이콘 컨셉을 다시 만들지 말 것. 같은 자리에서 세 번째 실패가 된다.
   *
   * ⚠️ 배경을 밝게 바꾸지 말 것. 광택 오브젝트는 어두운 바탕에서만 빛나 보인다.
   * ⚠️ 어느 톤에도 안 걸린다 — 고르는 사람이 직접 바꿀 때만 나온다 (`AD_CONCEPT_BY_TONE` 참고).
   */
  {
    id: 'icon-3d',
    name: '3D 아이콘',
    who: '사람 없이 광택 있는 입체 오브젝트',
    when: '물건·화면 하나로 설명될 때',
    desc: '어두운 배경에 주인공 하나를 크게 세웁니다. 주인공이 뚜렷하지 않은 주제엔 안 맞습니다.',
    swatch: ['#101B4B', '#FF6A13', '#FFD400'],
    person: false,
    /**
     * ⚠️ **2026-08-28 2판 — 「D 를 그냥 3D화 시킨 것밖에 없다」** (요청자 지적).
     *
     *    1판은 `one large hero … with two smaller three-dimensional objects floating at its left
     *    and right` 라고 썼다. 그 「두 개」가 과녁·막대그래프처럼 **뜻을 가진 아이콘**으로 나와
     *    히어로와 무게가 비슷해졌고, 결국 **아이콘 셋이 나란히 선 그림** = D 의 3D판이 됐다.
     *
     *    레퍼런스 2장(확성기·자명종)의 짜임은 그게 아니다 —
     *    **주인공 하나를 크게 세우고, 나머지는 전부 작은 장식**이다. 반짝임·번개·점·고리처럼
     *    **뜻이 없는 도형**이라 시선을 뺏지 않는다. 그래서 주인공이 무엇인지 한눈에 읽힌다.
     *
     * ⚠️ **알아볼 수 있는 물건은 히어로 하나뿐이다.** 곁에 두 번째 물건을 세우지 말 것 —
     *    세우는 순간 「아이콘 여러 개」가 되어 D 와 구분이 사라진다.
     * ⚠️ 배경을 밝게 바꾸지 말 것. 광택 오브젝트는 어두운 바탕에서만 빛나 보인다.
     */
    cast: 'no people and no photographs anywhere; one single glossy three-dimensional hero object rendered with rounded plastic-clay surfaces, soft studio lighting from the upper left, gentle reflections and a soft contact shadow beneath it, and it is the only recognisable object in the picture — everything else floating around it is small abstract decoration',
    palette: 'deep navy #101B4B background with a lighter radial glow behind the objects, vivid orange #FF6A13, highlight yellow #FFD400, alert red #E8391F, headline and body text in white',
    art: 'one three-dimensional rendered hero prop over a vivid gradient background, a radial burst of light spreading out from directly behind it, halftone dot texture in two corners, and small abstract accent shapes scattered around at a fraction of the hero size — sparkles, lightning bolts, rings and dots only',
    frame: [
      'no people anywhere, so the card is built as stacked horizontal bands with the three-dimensional objects filling the middle',
      'a small rounded pill sits at the very top centre holding the speech-bubble hook, in the highlight colour',
      'the headline sits under it, centred, in two stacked lines, the largest element on the card, with one key word filled in the highlight colour',
      'the number line sits directly under the headline inside a solid highlight-colour band, its digits far larger than the words beside them',
      'one glossy three-dimensional object is the hero of the picture and dominates the middle of the frame, drawn large enough to fill most of the width and lit from behind by the radial burst, with only small abstract sparkles, bolts and dots floating around it so that nothing else competes for attention',
      'the check items sit inside one rounded white card pinned across the lower area, one per row with a round check mark, the card bright against the dark background',
    ],
    prop: 'as the large glossy three-dimensional hero object in the centre of the frame',
  },
];

export const DEFAULT_AD_CONCEPT = AD_CONCEPTS[0].id;
export const getAdConcept = (id) => AD_CONCEPTS.find((c) => c.id === id) || AD_CONCEPTS[0];

/**
 * 톤앤매너 → 컨셉 (2026-08-21, 요청자 지시: "톤앤매너 선택에서 ~형에 따라 알맞은 스타일이
 * 광고형에 적용되도록").
 *
 * 1단계에서 이미 고른 것으로 정한다 — **같은 것을 두 번 고르게 하지 않는다.**
 * 8-31 ②에서 장수를 1단계로 넘긴 것과 같은 판단이다.
 *
 * | 톤 | 컨셉 | 왜 |
 * |---|---|---|
 * | trust 신뢰·정보형 | 정장 남성 | 숫자·근거로 믿음을 주는 자리 |
 * | hook 후킹·공감형 | 두 사람 만화 | 「이런 고민 → 이렇게 해결」이 곧 후킹 구성 |
 * | plain 담백·실무형 | 3D 아이콘 | 인물이 없어야 요점이 산다 |
 * | celebrate 축하·발표형 | 웃는 여성 | 소식을 밝게 전하는 자리 |
 *
 * ⚠️ **2026-08-28 — 3D 아이콘(`icon-3d`)은 어느 톤에도 안 걸린다.** 톤이 넷인데 컨셉이 다섯이라
 *    그렇다. 매장 사진 때와 같은 자리지만 이번엔 이유가 다르다 — 매장 사진은 프롬프트가
 *    자기모순이라 지웠고, 3D 아이콘은 **요청자가 직접 고르려고 만든 컨셉**이다.
 *    톤을 늘려 억지로 끼워 넣지 말 것.
 *
 * ⚠️ **2026-08-28 — 매장 사진(`scene-real`)을 지웠다** (요청자 지시). 톤 넷에 컨셉이 다섯이라
 *    어느 톤에도 안 걸려 직접 고를 때만 나왔는데, 그 하나 때문에 `subjectOf()` 의 「사진 배경 금지」와
 *    정면으로 부딪혔다 — 배경이 사진인 것이 정체성인 컨셉에게 사진을 그리지 말라고 지시하고 있었다.
 *    지금은 **톤 넷 : 컨셉 넷** 으로 일대일이다. 다섯째를 다시 넣으려면 톤도 같이 늘린다.
 * ⚠️ 옛 보관본에 `conceptId: 'scene-real'` 이 남아 있을 수 있다. `getAdConcept()` 가 기본값으로
 *    떨어뜨리므로 화면은 안 깨지지만, 그 게시물은 컨셉이 바뀌어 보인다.
 */
const AD_CONCEPT_BY_TONE = {
  trust: 'man-navy',
  hook: 'duo-cartoon',
  plain: 'icon-3d',
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
 *    맞는 지적이다. 한 구도가 나머지를 눌렀다. 가장 크게 드러난 것이 두 사람 만화(C)로,
 *    인물이 둘인데 `the model sits on the right side, waist-up` 이라는 **단수 문장**이 붙어
 *    「이런 고민 → 이렇게 해결」이라는 짜임이 통째로 사라졌다.
 *
 * | 컨셉 | 구도 |
 * |---|---|
 * | `woman-yellow` | 좌 60% 글자 + 우측 인물 + 점선 숫자 박스 (요청자 통과 · 건드리지 말 것) |
 * | `man-navy` | 룰 라인 · 각진 네이비 블록 · 세로 흰 카드 — 문서처럼 |
 * | `duo-cartoon` | **좌우 분할** — 왼쪽 회색(문제) / 오른쪽 노랑(해결), 가운데 화살표 |
 * | `icon-3d` | 인물 없음 → 좌우로 안 나누고 **가로 밴드 + 가운데 히어로 오브젝트** |
 *
 * ⚠️ **다시 하나로 합치지 말 것.** 합치는 순간 두 사람 만화의 좌우 분할이 먼저 죽는다.
 * ⚠️ 위치를 「왼쪽 60%」처럼 못박아 둔다. 안 적으면 모델이 글자를 가운데 모아
 *    포스터처럼 그린다 — 성과 광고 배너로 안 읽힌다.
 */
const FRAME_TAIL = [
  // 네 컨셉이 공유하는 유일한 줄이다. 레퍼런스 9장이 전부 이 하단 바를 갖고 있다.
  'a full-width solid CTA bar is pinned to the very bottom edge, with a circular icon on the left and a circular arrow button on the right',
];

/**
 * ⚠️ **장수를 여기서 고르지 않는다** (2026-08-20, 요청자 지시: "직관형은 왜 8장이야?
 *    상품 주제에서 선택되도록 해줘"). 장수는 1단계 「카드뉴스 장수」(`state.cardCount`) 하나가 정하고,
 *    광고형은 덱 길이를 그대로 쓴다.
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
 * ⚠️ **이 줄은 헤드라인이 던진 물음에 답해야 한다** (2026-08-28, 요청자 지적:
 *    "어디에 쓰나요 하는데 상장부터 메탈 현판까지 7종입니다를 제일 크게 보여주는게 맞냐?").
 *
 *    맞는 지적이었다. 헤드라인이 「인증물 7종 / 어디에 쓰나요」인데 바로 아래 제일 큰 글씨가
 *    「상장부터 메탈 현판까지 7종입니다」였다. 그건 **어디에**가 아니라 **무엇이 있나**에 대한 답이다.
 *    카드가 물음을 던지고 가장 큰 목소리로 **딴 질문에 답한** 꼴이다.
 *
 *    이 함수는 「숫자가 있는가」만 본다. 헤드라인이 무엇을 물었는지 **모른다.** 그래서 재료를
 *    넣는 쪽이 지켜야 하는 규칙이다 —
 *    **헤드라인이 「어디에」를 물으면 이 줄도 자리를 답하고, 「얼마나」를 물으면 양을 답한다.**
 *
 * ⚠️ **답은 세는 것이 아니라 가리키는 것이다** (2026-08-28, 같은 카드에서 두 번째 지적:
 *    "쓰는자리는 3곳입니다 라고 말하면 뭐 어쩌라고").
 *
 *    ①을 고치면서 「쓰는 자리는 3곳입니다」로 바꿨는데, 물음에는 답했지만 **개수만 세고
 *    어디인지는 말하지 않는다.** 「어디에 쓰나요」의 답은 숫자가 아니라 **장소**다.
 *    ⭕ 「매장·온라인·검색 3곳에 쓰시면 됩니다」 — 자리를 이름으로 대고 무엇을 하면 되는지까지 간다
 *    ❌ 「쓰는 자리는 3곳입니다」 — 세기만 한다   ❌ 「인증물 7종입니다」 — 딴 질문에 답한다
 *    숫자는 **답을 세는 말**이지 답 자체가 아니다. 이 줄에서 숫자가 커 보이는 건 강조 장치일 뿐,
 *    숫자만 남기고 대상을 빼면 읽는 사람이 가져갈 것이 없다.
 *    ⚠️ 자동 판정을 시도했다가 접었다. 한국어 2-gram 겹침으로 고르면 헤드라인의 **주어**를
 *       되풀이하는 후보(「인증물 7종」)가 가장 높은 점수를 받아 오히려 이 실패를 고른다.
 *       겹침이 낮은 것을 고르게 뒤집으면 이번엔 브랜드명이 반복되는 정상 후보
 *       (「KBS 1TV·2TV 드라마에 나갑니다」)가 탈락한다. 규칙으로 가를 수 있는 문제가 아니다.
 *
 * ⚠️ **지어내지 않는다.** 상품 자료(`facts`)나 그 카드 본문에 숫자가 있으면 그것을 쓰고,
 *    없으면 이 줄을 통째로 비운다. 광고 이미지에 큰 글씨로 찍히는 숫자라 틀리면 그대로 사고다.
 * ⚠️ **통째로 들어가는 것만 쓴다.** 어절 경계에서 끊어도 「심사 배점 1,000점 중 고객만족도가」
 *    같은 조각이 남는데, 이 줄은 그림에서 가장 큰 글씨라 조각이면 바로 눈에 띈다.
 */
function numberLine(product, deck, exclude = '') {
  const hasNum = /\d/;
  const same = (a, b) => normalizeLine(a) === normalizeLine(b);
  /**
   * ⚠️ **덱 한 장이 아니라 덱 전체를 훑는다** (2026-08-28). 예전에는 표지 카드 하나만 봐서,
   *    숫자가 3번 카드에 있으면 그 줄이 통째로 비었다. 한 장만 만드는 지금은 그게 곧
   *    「근거 없는 배너」다 — 재료가 어디 있든 찾아 쓴다.
   *
   * ⚠️ **보조 문구로 이미 쓴 문장은 건너뛴다** (`exclude`). 둘 다 표지 카드 본문에서 나오므로
   *    안 막으면 **같은 문장이 큰 숫자 자리와 보조 문구 자리에 두 번 찍힌다** — 실측에서 걸렸다.
   *
   * ⚠️ **길이까지 한 번에 거른다** (2026-08-28 버그 수정). 예전에는 `find()` 로 **숫자 든 첫
   *    조각 하나만** 집고 나서 길이를 쟀다. 그 하나가 32자를 넘으면 버려지는데 **다음 후보를
   *    안 봤다** — 덱 뒤쪽에 딱 맞는 줄이 있어도 검토조차 안 되고 이 줄이 통째로 비었다.
   *    실제로 KBS N 주제에서 3번 카드의 알맞은 줄이 2번 카드의 긴 줄에 가려 버려졌다.
   */
  const fits = (x) => {
    const c = clean(x);
    return c && hasNum.test(c) && c.length <= NUMBER_MAX && !same(c, exclude);
  };
  const fromDeck = deck.flatMap((c) => clean(c && c.body).split(/(?:[.!?])\s|\n/));
  const fromFacts = (product.facts || []).map((x) => String(x));
  return clean([...fromDeck, ...fromFacts].find(fits) || '');
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
 * 소품 안의 화면·간판·자막 바에 **무엇이 적히는가** (2026-08-28 2판).
 *
 * 1판은 빈칸을 막으려고 **브랜드 핸들**(`@kbsn_brandawards`)을 넣게 했다. 빈칸은 사라졌지만
 * 요청자 지적이 정확했다 — "KBSN @를 넣어두면 처음 보는 사람은 이해하기 어려운것같아",
 * "화면에 @KBS ~ 가 들어가는게 아니라 **여기 광고가 들어간다**는게 맞는것같아."
 *
 * 맞는 말이다. 그 화면은 **브랜드가 이미 나간 결과**가 아니라 **광고가 들어갈 자리**를
 * 보여 주는 견본이다. 계정명을 박으면 「이 계정이 방송에 나온다」로 읽혀 뜻이 뒤집힌다.
 * 자리 표시임을 한국어로 적어 줘야 처음 보는 사람이 한 번에 안다.
 *
 * ⚠️ 라벨은 **`product.propLabel` 로 명시할 때만** 넣는다. 자동으로 붙이지 않는다 —
 *    소품에 화면이 없는 주제(트로피·상장 같은 것)에서는 갈 곳 없는 글자가 떠돈다.
 *    `PROP_LABEL_FALLBACK` 이 무난한 기본 문구다.
 * ⚠️ 라벨은 **찍히는 글자 목록에도 함께 넣는다**(`promptOf`). 안 넣으면 `no invented text` 에
 *    걸려 그 자리가 다시 빈칸이 된다 — 1판에서 빈칸이 났던 경로가 정확히 이것이다.
 */
export const PROP_LABEL_FALLBACK = '여기에 광고가 들어갑니다';
const PROP_LABEL_MAX = 16;

const filledProp = (label) => label
  /**
   * ⚠️ **무엇을 적을지는 영문이 정하지 않는다** (2026-08-28 2판). 처음엔 여기에
   *    `a blank advertising slot … showing where an advertisement would go` 를 박아 뒀는데,
   *    그건 슈퍼자막처럼 「광고가 들어갈 자리」를 보여 주는 주제에만 맞는다. 완전 시청 과금처럼
   *    **화면이 진행 상태를 보여 주는** 주제에서는 뜻이 어긋난다.
   *    영문은 「이 라벨을 화면에 적어라」까지만 말하고, 내용은 `propLabel` 이 정한다.
   */
  ? ', and the screen, sign or caption bar belonging to this prop carries the short Korean'
    + ' label lettered across it at a readable size, filled in with that lettering rather'
    + ' than left empty'
  : ', and any screen, sign or caption bar belonging to this prop is filled in with real'
    + ' lettering rather than left blank';

/**
 * 이 카드가 **무엇을 보여주는지** — 주제에서 나온다.
 *
 * ⚠️ 여기가 개편의 핵심이다. `card.shot` 은 아웃라인이 그 항목을 보고 지은 영문 장면이라
 *    주제가 바뀌면 같이 바뀐다. 이걸 안 쓰면 그림이 고정 배치 문구만 따라가서
 *    **주제와 무관한 같은 그림**이 나온다 (8-20 ②와 같은 실패다).
 */
function subjectOf(deck, topic, where, propLabel) {
  const shot = clean((deck.find((c) => c && c.shot) || {}).shot);
  /**
   * ⚠️ **`shot` 을 그대로 넣지 않는다** (2026-08-28). 그건 아웃라인이 A·B·C **실사 사진**을 위해
   *    지은 장면 묘사다 — 조명·심도·카메라 각도까지 들어 있다. 플랫 벡터 광고 배너에 통째로
   *    넣으면 결이 어긋난 사진 장면이 화면 한복판에 들어앉는다. 뒷장이 무너졌던 원인 ②다.
   *
   *    그래서 **장면에서 사물 하나만 뽑아 납작한 소품으로 그리라고** 감싼다.
   *    감싸는 문장이 없으면 모델은 장면 전체를 그린다.
   *
   * ⚠️ 감싸는 말은 **명사구**로 쓴다 (2026-08-28 3판). 예전에는 `take the single most important
   *    object from this scene description and draw it …` 이라는 명령문이었는데,
   *    `take … from …` 은 **원본에서 뽑아 온다**는 뜻이라 편집 지시로 읽혔다.
   *    지금은 `one flat graphic prop …, showing …` 로 무엇을 그린 그림인지만 말한다.
   */
  if (shot) {
    return 'the single most important object named here and only that object, drawn'
      + ` ${where}, with no scene or setting around it, no photographic background,`
      + ` no depth of field and no camera angle: "${shot}"`
      + filledProp(propLabel);
  }
  // 아웃라인이 없는 경로(규칙 기반·옛 보관본)에서는 주제라도 넘긴다.
  const fallback = clean((deck[0] && deck[0].title) || topic);
  return fallback
    ? `${where}, representing: "${fallback}"` + filledProp(propLabel)
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
    propLabel: trimWords(product.propLabel || '', PROP_LABEL_MAX),
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
    prompt: promptOf({ product, concept, copy, subject: subjectOf(deck, topic, concept.prop, copy.propLabel) }),
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
    copy.propLabel && `label lettered inside the prop's screen or sign: "${copy.propLabel}"`,
    copy.bullets.length ? `check list items: ${copy.bullets.map((b) => `"${b}"`).join(' / ')}` : '',
    copy.cta && `bottom CTA bar: "${copy.cta}"`,
  ].filter(Boolean).map((line) => `  - ${line}`).join('\n');

  /**
   * ⚠️ **2026-08-28 (3판) — 낱말을 다 걷어냈는데도 편집으로 잡혔다.** 이번엔 낱말이 아니라
   *    **프롬프트의 생김새**가 원인이었다 (요청자 보고: "문제가 계속 발생하네").
   *
   *    앞의 네 줄이 전부 **명령문**이었다 — `Create …` `Output …` `Work only …` `do not divide
   *    the canvas` `do not draw more than one card`. 생성 프롬프트는 보통 **그림을 묘사하는
   *    명사구**로 시작하고, 편집 지시는 **그림에 무엇을 하라는 명령문**으로 시작한다.
   *    라우터가 앞부분만 읽으면 이건 통째로 편집 지시로 보인다. 「무엇을 그릴지」가 아니라
   *    「무엇을 하지 말지」가 먼저 나왔으니 더 그렇다.
   *
   *    그래서 **머리를 명사구 한 줄로 줄이고, 제약은 전부 맨 끝 `negative:` 로 내렸다.**
   *    `negative:` 목록은 text-to-image 쪽의 관습이라 오히려 생성 신호로 읽힌다.
   *
   * ⚠️ **맨 앞에 명령문을 다시 만들지 말 것.** `Create`·`Output`·`Generate`·`Make` 로 시작하거나
   *    `do not …` 을 앞쪽에 두면 이 문제가 그대로 돌아온다. 첫 줄은 항상 **무엇인지**로 연다.
   * ⚠️ 지운 것이 아니라 **자리를 옮긴 것이다.** 아래 셋은 `negative:` 안에서 계속 살아 있다 —
   *    ① 4분할 방지(`no grid, no collage, no multiple cards`)
   *    ② 한 장 완결(`no follow-up card, no continuation`)
   *    ③ 여백 방지(`no blank placeholder frames`)
   *    ⚠️ negative 에서 이 셋을 빼면 8-21 의 「4장이 1장에 4컷으로」가 그대로 돌아온다.
   */
  return [
    'Square 1:1 Korean direct-response social advertising banner, one single full-bleed card'
      + ' filling the whole frame, complete on its own, drawn entirely from the written description'
      + ' below.',
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
    'Korean text printed on the card, exactly as written, character for character, and no other words anywhere in the picture:',
    lines,
    '',
    `brand handle in small type at a corner: "${clean(product.handle || product.short)}"`,
    'negative: no English sentences, no invented text, no empty boxes or blank rectangles standing in for text, no placeholder lines, no lorem ipsum, no garbled or misspelled Hangul, no watermark, no stock-photo logo, no extra taglines beyond the list above, no blank placeholder frames, no grid, no collage, no multi-panel layout, no set of thumbnails, no multiple cards in one picture, no follow-up card, no continuation, no border frames around the card',
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
