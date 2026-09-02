/**
 * 템플릿별 편집 슬롯 정의
 *
 * 컨셉마다 카드에 들어가는 글의 '자리'가 다르다. 매거진형은 모든 장이 같은 구조지만,
 * 카드형은 표지/본문/마무리가 각각 다르고 노트형은 표지만 다르다.
 *
 * 이 파일이 그 차이를 한곳에 모아 둔다.
 * - 오른쪽 편집 폼(pages/template.js)이 어떤 입력칸을 그릴지
 * - 렌더러(lib/cardrender.js)가 어떤 값을 읽을지
 * 두 곳이 같은 정의를 보게 해서 어긋나지 않게 한다.
 *
 * label 에는 '카드 어디에 들어가는 글인지'를 반드시 함께 적는다.
 * 미리보기와 입력칸을 눈으로 잇는 유일한 단서다.
 */

/** 카드 종류(kind) → 템플릿이 구분하는 역할(role) */
/**
 * ⚠️ **`follow` 가 카드형의 팔로우 장이다** (2026-08-21). 예전에는 `outro` 가 그 자리였는데,
 *    그러면 고른 장수 중 한 칸을 내용 없는 장이 차지했다 (`withFollowCard()` 주석 참고).
 *    이제 `outro`(글에 맞춰 생성한 마무리 문장 + CTA)는 **읽히는 본문 장**이고, 팔로우 장은 따로 붙는다.
 *    ⚠️ 화면·렌더러·이미지 패널이 전부 `roleOf(...) === 'outro'` 로 팔로우 장을 판별한다.
 *       여기 한 곳만 고치면 셋이 함께 따라온다 — 개별로 `kind` 를 비교하지 말 것.
 */
export function roleOf(conceptId, kind) {
  if (conceptId === "magazine") return "all"; // 모든 장이 같은 구조
  if (kind === "cover") return "cover";
  if (kind === "follow")
    return conceptId === "card" || conceptId === "note" ? "outro" : "body";
  return "body";
}

const HANDLE = {
  id: "footer",
  label: "계정 아이디 (하단)",
  hint: "카드 왼쪽 아래",
  tag: "input",
  max: 24,
};

const CARD_BODY_HINT =
  "'**강조**' 로 감싸면 굵고 진하게. 줄 앞 '> ' 는 테마색 박스, " +
  "줄 앞 1. 2. 는 번호 박스. 빈 줄로 문단을 나눕니다.";

/**
 * 슬롯별 글자 수 상한 (`max`).
 *
 * 요청자 요구(2026-08-10): "카드뉴스에서 글자 레이아웃과 행간은 아주 중요하다.
 * 넘어가지 않도록 확실한 방지책을 세우고, 정 안 되면 **처음 생성할 때 글자 수를 제한**하라."
 *
 * ⚠️ 이 숫자는 **눈대중이 아니라 렌더러로 실측한 값이다.** (2026-08-10)
 *    기준은 '잘리기 직전'이 아니라 **'글자 크기가 한 번도 줄지 않는 지점'** 이다.
 *    잘리지만 않으면 된다고 잡으면 글자가 최소 크기까지 작아져 레퍼런스의 행간이 무너진다.
 *
 * | 슬롯 | 원래 크기 유지 | 잘리기 직전 | 여기서 정한 값 |
 * |---|---|---|---|
 * | magazine title+highlight | 각 30 | 각 61 | 각 22 |
 * | card cover title | 58 | 85 | 52 |
 * | card body title / body | 49 / 413 | 67 / 853 | 44 / 380 |
 * | card outro body | 213 | 283 | 190 |
 * | note cover title / 부제 | 40 / 61 | 58 / 75 | 36 / 55 |
 * | note body title / body | 45 / 420 | 66 / 766 | 40 / **170** |
 *
 * 실측보다 낮춰 잡은 이유: 글자 폭이 문장마다 달라서(숫자·영문·기호) 딱 맞춰 두면 넘친다.
 *
 * ⚠️ **노트형 본문(170) — 2026-09-02 재실측.** 2026-08-31 피그마 재설계로 검정 박스가
 *    고정 폭(396px)·최대 4줄 구조로 바뀌어 이전 표(220)의 근거였던 하이라이트 바·번호 목록
 *    레이아웃이 더 이상 없다. 헤드리스 브라우저로 실제 렌더러(`renderNoteBody`→`noteCaption`)에
 *    한글 순문장을 밀어 넣어 `lastClipped()` 를 확인한 결과 **208자부터 잘림**, 204자까지는
 *    안전했다. 여기에 여유를 두고 170으로 정했다 — 요청자 지적("본문이 다 한 줄씩이다")대로
 *    옛 90자는 이 박스가 실제로 담을 수 있는 양의 절반도 안 됐다.
 *    ⚠️ 이 박스 레이아웃을 다시 바꾸면(폭·최대 줄 수) 반드시 재실측할 것 — 계산이 아니라
 *    `lastClipped()` 로 직접 확인해야 한다(위 실측 방법, 정확도가 다르다).
 *
 * ⚠️ `max` 는 **생성 기본값에만** 적용된다. 사용자가 직접 더 길게 쓰는 것은 막지 않는다
 *    (요청자 지시: 이후에는 수정 가능하도록). 대신 넘치면 화면이 경고한다.
 * ⚠️ 렌더러의 `sizes`·`maxLines` 를 건드렸다면 이 표를 **반드시 다시 재야 한다.**
 */
const SLOTS = {
  magazine: {
    all: [
      {
        id: "brand",
        label: "계정 이름 (상단 왼쪽 또는 가운데)",
        hint: "카드 맨 위 — 템플릿에 따라 왼쪽 또는 가운데",
        tag: "input",
        max: 20,
      },
      // 자동 생성 문구를 여기서 자르지 않는다. 렌더러가 실제 폰트 폭으로 맞추고,
      // 생성 단계는 별도로 길이를 검수한다. 이 상한은 사용자가 직접 쓴 긴 문구의 안전망이다.
      {
        id: "title",
        label: "제목 (흰색, 가장 큰 글씨)",
        hint: "한 줄로 읽히는 짧은 후킹",
        tag: "textarea",
        rows: 2,
        max: 40,
      },
      {
        id: "highlight",
        label: "강조 문구 (형광색)",
        hint: "제목 아래 붙는 한 줄. 색은 아래 「강조 색상」에서 고릅니다.",
        tag: "textarea",
        rows: 2,
        max: 40,
      },
      HANDLE,
    ],
  },
  card: {
    /**
     * ⚠️ 표지와 본문은 **배치가 다르다.** 레퍼런스 표지는 하단에 테두리 알약 + 아주 큰 흰 제목이고,
     *    본문만 상단 알약 + 하단 흰 박스다. 한 번 같게 합쳤다가 되돌렸다(2026-08-03).
     */
    cover: [
      {
        id: "eyebrow",
        label: "카테고리 라벨 (테두리 배지)",
        hint: "제목 바로 위",
        tag: "input",
        max: 16,
      },
      {
        id: "title",
        label: "제목 (흰색, 여러 줄)",
        hint: "가장 크게 들어가는 문장",
        tag: "textarea",
        rows: 3,
        max: 52,
      },
      HANDLE,
    ],
    body: [
      {
        id: "title",
        label: "제목 (흰 패널 위쪽, 테마색 글씨)",
        hint: "사진 아래 흰 패널 맨 위 — 테마색 강조 문구",
        tag: "textarea",
        rows: 2,
        max: 44,
      },
      {
        id: "body",
        label: "본문 (흰 패널 안, 검정 글씨)",
        hint: CARD_BODY_HINT,
        tag: "textarea",
        rows: 7,
        max: 380,
      },
      {
        id: "source",
        label: "출처 (선택)",
        hint: "흰 패널 맨 아래 오른쪽에 작게. 없으면 비워 두세요.",
        tag: "input",
        max: 30,
      },
      {
        id: "footer",
        label: "계정 아이디 (흰 패널 맨 아래 왼쪽)",
        hint: "카드 왼쪽 아래",
        tag: "input",
        max: 24,
      },
    ],
    outro: [
      {
        id: "body",
        label: "팔로우 유도 문구 (중앙)",
        hint: "테마색 단색 배경 가운데. Enter 로 줄을 나눕니다.",
        tag: "textarea",
        rows: 5,
        max: 190,
      },
      {
        id: "footer",
        label: "계정 아이디 (중앙 하단)",
        hint: "문구 아래 가운데",
        tag: "input",
        max: 24,
      },
    ],
  },
  note: {
    /**
     * 2026-08-31 피그마 재설계(node 142-475/142-467/142-500) 반영.
     * 표지·본문 모두 **가운데 정렬 손글씨체 제목 → 이미지(AI 생성) → 짧은 설명**으로 통일했고,
     * 본문·팔로우 장에만 계정 핸들(`footer`)이 붙는다(표지에는 없다 — 피그마 그대로).
     * ⚠️ 본문 설명은 검정 박스 안에 최대 4줄까지 들어간다(`noteCaption()`). 긴 서식(하이라이트
     *    바·번호 목록)은 상자 안에 안 들어가 뺐다 — `CardForm.jsx` 의 서식 도구도 노트형에는
     *    띄우지 않는다. ⚠️ **"한두 줄만 담는다"였던 예전 설명은 폐기했다** (2026-09-02, 요청자
     *    지적 — "본문이 다 한 줄씩이다"). 박스 자체는 처음부터 4줄을 담을 수 있었는데
     *    슬롯 상한(`max`)만 90자로 너무 낮게 잡혀 있었다. 자세한 실측은 위 SLOTS 머리말 참고.
     */
    cover: [
      {
        id: "title",
        label: "제목 (중앙, 손글씨체)",
        hint: "카드 위쪽 가운데",
        tag: "textarea",
        rows: 2,
        max: 36,
      },
      {
        id: "body",
        label: "부제 (중앙, 회색 한 줄)",
        hint: "제목 바로 아래",
        tag: "input",
        max: 55,
      },
    ],
    body: [
      {
        id: "title",
        label: "대주제 (중앙, 손글씨체)",
        hint: "상단 심볼 아래 가운데 제목",
        tag: "textarea",
        rows: 2,
        max: 36,
      },
      {
        id: "body",
        label: "설명 (검정 박스, 흰 글씨)",
        hint: "이미지 아래 설명 — 최대 4줄까지 들어갑니다",
        tag: "textarea",
        rows: 3,
        max: 170,
      },
      {
        id: "footer",
        label: "계정 아이디 (하단 가운데)",
        hint: "카드 맨 아래",
        tag: "input",
        max: 24,
      },
    ],
    outro: [
      {
        id: "body",
        label: "팔로우 유도 문구 (중앙, 손글씨체)",
        hint: "상단 심볼 아래 가운데 큰 글씨. Enter로 줄바꿈",
        tag: "textarea",
        rows: 5,
        max: 90,
      },
      {
        id: "footer",
        label: "계정 아이디 (하단 가운데)",
        hint: "문구 아래",
        tag: "input",
        max: 24,
      },
    ],
  },
};

/**
 * @param {string} conceptId
 * @param {string} kind buildDeck() 카드의 kind
 * @returns {Array<{id:string,label:string,hint:string,tag:string,rows?:number}>}
 */
export function slotsFor(conceptId, kind) {
  const byRole = SLOTS[conceptId] || SLOTS.magazine;
  return byRole[roleOf(conceptId, kind)] || byRole.body || byRole.all;
}

/**
 * 자유 배치(위치·크기 커스텀) 대상 오브젝트 목록.
 *
 * 정적 좌표표는 두지 않는다 — 기본 위치는 항상 렌더러(lib/cardrender.js)가 실제로 그린
 * 상자(`lastBoxes()`)에서 얻는다. 이 목록은 "이 카드에 드래그 손잡이를 몇 개, 어떤 라벨로
 * 그릴지"만 정한다.
 *
 * 매거진·카드·노트 세 컨셉 모두 오브젝트별 자유 배치를 지원한다. 목록에 없는 컨셉만
 *    빈 배열을 돌려준다.
 *
 * `title` 오브젝트는 슬롯 정의의 `title`+`highlight` 두 칸을 **한 상자로 묶어** 다룬다.
 * 매거진형 제목과 형광 강조줄은 같은 크기로 붙어 읽혀야 하는 한 덩어리라서(`fitPair`),
 * 따로 움직이게 하면 그 설계 의도가 깨진다.
 *
 * @param {string} conceptId
 * @param {string} kind
 * @param {string} [magazineTemplate] 매거진형에서만 쓴다 — t2·t4 는 구분선(`divider`)
 *   오브젝트가 하나 더 있다 (`lib/concepts.js` 의 `MAGAZINE_TEMPLATES`).
 */
export function objectsFor(conceptId, kind, magazineTemplate) {
  if (conceptId === "magazine") {
    const objs = [
      { id: "brand", type: "text", label: "계정 이름" },
      { id: "title", type: "text", label: "제목 + 강조 문구" },
      { id: "footer", type: "text", label: "계정 아이디" },
    ];
    if (magazineTemplate === "t2" || magazineTemplate === "t4")
      objs.push({ id: "divider", type: "line", label: "구분선" });
    objs.push({ id: "image", type: "image", label: "배경 이미지" });
    return objs;
  }
  const role = roleOf(conceptId, kind);
  if (conceptId === "card") {
    if (role === "outro")
      return [
        { id: "body", type: "text", label: "팔로우 문구" },
        { id: "footer", type: "text", label: "계정 아이디" },
      ];
    return [
      {
        id: "eyebrow",
        type: "text",
        label: role === "cover" ? "카테고리 라벨" : "제목",
      },
      {
        id: role === "cover" ? "title" : "body",
        type: "text",
        label: role === "cover" ? "제목" : "본문",
      },
      { id: "footer", type: "text", label: "계정 아이디" },
      { id: "image", type: "image", label: "배경 이미지" },
    ];
  }
  if (conceptId === "note") {
    if (role === "outro")
      return [
        { id: "body", type: "text", label: "팔로우 문구" },
        { id: "footer", type: "text", label: "계정 아이디" },
      ];
    return [
      {
        id: "title",
        type: "text",
        label: role === "cover" ? "제목" : "대주제",
      },
      { id: "body", type: "text", label: role === "cover" ? "부제" : "설명" },
      ...(role === "body"
        ? [{ id: "footer", type: "text", label: "계정 아이디" }]
        : []),
      {
        id: "image",
        type: "image",
        label: role === "cover" ? "일러스트" : "카드 이미지",
      },
    ];
  }
  return [];
}

/** 첫 문장만 뽑는다 — 강조 한 줄에 문단 전체가 들어가면 카드가 무너진다 */
const firstSentence = (text = "") => {
  const line =
    String(text)
      .split("\n")
      .find((l) => l.trim()) || "";
  const m = line.match(/^.*?[.?!](?=\s|$)/);
  return (m ? m[0] : line).trim();
};

/**
 * 매거진형 표제용으로 짧게 줄인다.
 *
 * 레퍼런스의 제목은 두 줄, 각 줄 15자 안팎이다. 카드 문구를 그대로 넣으면
 * 줄이 늘어나면서 글자가 작아지고 행간이 무너져 '글이 넘치는' 느낌이 된다.
 * 첫 문장만 쓰고, 그마저 길면 절 경계(쉼표·가운뎃점)에서 자른다. 마침표는 뗀다.
 * 어절 중간에서는 절대 자르지 않는다 — 한국어가 어색해진다.
 */
function headline(text, max = 30) {
  let s = firstSentence(text).replace(/\s+/g, " ").replace(/\.$/, "").trim();
  if (s.length <= max) return s;
  const clause = s.slice(0, max + 8).match(/^[^,·]{8,}(?=[,·])/);
  if (clause) return clause[0].trim();
  return s
    .slice(0, max)
    .replace(/\s+\S*$/, "")
    .trim(); // 마지막 어절은 통째로 버린다
}

/**
 * 매거진형 한 줄에 들어가는 글자 수.
 *
 * ⚠️ **눈대중이 아니라 렌더러 폰트로 실측한 값이다** (2026-08-13, MAXW 904px 기준).
 *    Noto Sans KR 900 기준 한글 한 자의 폭 — 82px: 75.4 / 74px: 68.1 / 66px: 60.7 / 58px: 53.4.
 *    가장 작은 후보(58px)에서 904 / 53.4 ≈ 16자, 띄어쓰기가 섞이면 18~19자까지 한 줄에 들어간다.
 *    렌더러가 두 줄에 맞춰 크기를 낮추므로(`fitPair` 의 `tightLines`) 이 값까지는 항상 한 줄이다.
 *
 * 요청자 지시(2026-08-13): "후킹 멘트가 2줄이 되니깐 행렬이 디자인적으로 이쁘지가 않아.
 * 앞으로 표지·본문에 들어가는 내용은 후킹식으로 가장 중요하고 끌릴 만한 말로만."
 * → 흰 줄 하나 + 형광 줄 하나, **각각 한 줄**로 끝나야 한다.
 *
 * 58px에서는 한글 16자까지 들어간다. 공백이 섞이면 실제 폭은 더 짧다.
 * 13자 균등 분할은 아직 들어갈 단어까지 다음 줄로 보내므로, 실측 안전값인 16자를 쓴다.
 */
const MAG_LINE_MAX = 16;

/**
 * 한 문장을 흰 줄 / 형광 줄로 나눈다.
 * 레퍼런스가 정확히 이 구조다 — 한 문장을 두 줄로 끊고 뒷줄만 형광색으로 준다.
 *
 * ⚠️ **두 줄 다 `max` 안에 들어가는 자리를 고른다.** 예전에는 쉼표가 있으면 무조건 거기서 잘랐다.
 *    그래서 「지역 광고, 시 단위가 아니라 구 단위까지 좁힐 수 있어요」가
 *    "지역 광고,"(5자) + "시 단위가 아니라 구 단위까지 좁힐 수 있어요"(22자) 로 갈려서,
 *    뒷줄이 카드에서 두 줄로 감기고 상한에 걸려 "…"까지 붙었다(요청자 지적).
 *
 * 고르는 순서 — ① 두 줄 다 들어가면서 첫 줄을 가장 충분히 채우는 자리
 *               ② 하나도 없으면 넘치는 양이 가장 적은 자리
 * 어절 중간에서는 절대 자르지 않는다.
 */
function splitHeadline(s, max = MAG_LINE_MAX) {
  const text = String(s).trim();
  if (text.length <= 12) return [text, ""];

  const cuts = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== " ") continue;
    const head = text.slice(0, i).trim();
    const tail = text.slice(i + 1).trim();
    if (!head || !tail) continue;
    cuts.push({
      head,
      tail,
      comma: head.endsWith(","),
      // 한국어 표제는 단순 글자 수보다 조사 뒤에서 끊을 때 의미 덩어리가 산다.
      // 예: 「연말 일정표에 / 넣을 시상식 하루」
      particle: /(?:에서|에게|으로|까지|부터|보다|처럼|만큼|마다|에는|에도|은|는|이|가|을|를|에|의|와|과|도|만)$/.test(
        head.split(/\s+/).at(-1) || "",
      ),
      fits: head.length <= max && tail.length <= max,
      over: Math.max(0, head.length - max) + Math.max(0, tail.length - max),
      gap: Math.abs(head.length - tail.length),
    });
  }
  if (!cuts.length) return [text, ""];

  const fitting = cuts.filter((c) => c.fits);
  const pool = fitting.length ? fitting : cuts;
  // 조사 뒤 → 두 줄의 균형 → 쉼표 뒤 순서로 고른다. 첫 줄을 끝까지 채우면
  // 「시상식 / 하루」처럼 의미 단위가 찢어지므로 글자 수만 최대화하지 않는다.
  pool.sort(
    (a, b) =>
      a.over - b.over ||
      Number(b.particle) - Number(a.particle) ||
      a.gap - b.gap ||
      Number(b.comma) - Number(a.comma),
  );
  return [pool[0].head, pool[0].tail];
}

/**
 * 카드 한 장의 추천 문구 초기값.
 * 슬롯에 없는 값은 만들지 않는다 — 폼과 렌더러가 보는 키를 정확히 일치시킨다.
 *
 * @param {string} conceptId
 * @param {object} card buildDeck() 결과의 한 항목
 * @param {object} product Supabase에서 불러온 상품
 */
/**
 * 상한에 맞춰 줄인다 — **어절 중간에서 자르지 않는다.** 한국어가 어색해지기 때문이다.
 * 문장 경계가 있으면 거기서, 없으면 마지막 어절을 통째로 버린다.
 */
export function clampSlot(text, max) {
  const s = String(text ?? "");
  if (!max || s.length <= max) return s;

  // 문장 단위로 담을 수 있는 만큼만 담는다 (문단 구분은 살린다)
  const parts = s.split(/(?<=[.?!])\s+/);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  if (out.length >= max * 0.6) return out.trim();

  // 문장 하나가 통째로 상한을 넘는 경우 — 마지막 어절을 버리고 말줄임을 붙인다
  const cut = s
    .slice(0, max - 1)
    .replace(/\s+\S*$/, "")
    .trim();
  return `${cut || s.slice(0, max - 1).trim()}…`;
}

/** 여러 줄 구조(하이라이트 바·번호 목록)를 가진 본문은 **줄 단위로** 덜어낸다 */
function clampBlocks(text, max) {
  const s = String(text ?? "");
  if (!max || s.length <= max) return s;
  const blocks = s.split("\n\n");
  while (blocks.length > 1 && blocks.join("\n\n").length > max) blocks.pop();
  const out = blocks.join("\n\n");
  return out.length <= max ? out : clampSlot(out, max);
}

/**
 * 카드형 본문 카드의 글을 요약한다 (2026-09-02, 요청자 지시로 도입).
 *
 * 카드형 흰 패널은 최대 380자까지 들어가는데, `clampSlot()` 은 상한까지 문장을
 * **있는 대로 채워 넣는다.** 그러면 카드 한 장이 요약이 아니라 원문 발췌로 읽힌다 —
 * 문장이 2~3개면 전부, 규칙 기반 폴백에서는 승인된 QA 원문 전체가 그대로 들어간다.
 *
 * API 를 새로 부르지 않는다(요청자 결정 — 규칙 기반). 문장 경계 단위로 **목표 길이 안에
 * 들어오는 만큼만** 문장을 이어 붙인다. 원문은 이미 핵심부터 말하도록 만들어져 있어
 * (아웃라인 `a` 필드·규칙 기반 QA 모두 결론이 먼저 온다) 앞 문장부터 담아도 뜻이 안 끊긴다.
 *
 * ⚠️ **목표를 140 → 240 으로 올렸다** (같은 날, 요청자 재지적 — "카드형 본문이 다 한 줄씩이다").
 *    140(첫 문장 + 짧으면 둘째 문장)은 요약을 넘어 "한 줄"로 느껴질 만큼 짧았다.
 *    240은 흰 패널 상한(380)의 63% 선이라 여전히 원문 전체를 그대로 붙이는 것과는 다르고,
 *    헤드리스 렌더러 실측(`lastClipped()`)으로 328자까지 잘림이 없는 것도 확인했다 —
 *    240은 그 안에서 넉넉한 여유를 두고 고른 값이다.
 * ⚠️ 노트형·매거진형에는 적용하지 않는다. 노트형은 이 함수를 거치지 않고 슬롯 상한
 *    (`note.body.max` = 170)이 곧 요약 길이 역할을 한다. 카드형 '본문' 카드만 흰 패널이
 *    넓어서(380자) `clampSlot()` 하나로는 요약처럼 보이지 않는 문제가 두드러졌다.
 */
const CARD_SUMMARY_TARGET = 240;
function summarizeForCard(text, target = CARD_SUMMARY_TARGET) {
  const s = String(text ?? "").trim();
  if (!s) return s;
  const sentences = s.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (sentences.length <= 1) return s;
  let out = sentences[0];
  for (let i = 1; i < sentences.length; i++) {
    const next = `${out} ${sentences[i]}`;
    if (next.length > target) break;
    out = next;
  }
  return out;
}

/**
 * 카드 한 장의 추천 문구 초기값.
 * 슬롯에 없는 값은 만들지 않는다 — 폼과 렌더러가 보는 키를 정확히 일치시킨다.
 *
 * ⚠️ 만든 값은 **반드시 슬롯 상한(`max`)을 지킨다.** 그래야 처음 열었을 때 카드가
 *    레퍼런스 그대로 보인다. 사용자가 나중에 더 길게 쓰는 것은 막지 않는다.
 *
 * @param {string} conceptId
 * @param {object} card buildDeck() 결과의 한 항목
 * @param {object} product Supabase에서 불러온 상품
 */
export function defaultsFor(conceptId, card, product) {
  const role = roleOf(conceptId, card.kind);
  const slots = slotsFor(conceptId, card.kind);
  const pick = (obj) => {
    const out = {};
    slots.forEach((s) => {
      const raw = obj[s.id] ?? "";
      // 본문처럼 문단 구조가 있는 칸은 줄 단위로, 나머지는 문장 단위로 줄인다
      out[s.id] =
        s.id === "body" && String(raw).includes("\n\n")
          ? clampBlocks(raw, s.max)
          : clampSlot(raw, s.max);
    });
    return out;
  };

  if (conceptId === "magazine") {
    /**
     * 핵심 한 문장만 쓰고 두 줄로 나눈다 — 뒷줄이 형광색이다.
     * 두 줄 합쳐 상한 안에 들어오게 먼저 줄인다 — 그래야 splitHeadline 이 "…" 없이 나눈다.
     *
     * ⚠️ **마무리 장 예외를 없앴다** (2026-08-20). "승인된 문장이라 쪼개지 않는다"고 적혀 있었지만
     *    바로 아래 `pick()` 의 `clampSlot()` 이 **16자에서 그대로 잘랐다.** 쪼개지 않은 게 아니라
     *    한 줄만 남기고 버린 것이다 — 「중앙일보 연합광고와 포브스…」가 그렇게 나왔다.
     *    두 줄로 쪼개면 32자까지 들어가고, 마무리 제목은 이제 CTA(23~32자)라 온전히 들어간다.
     */
    // 의미가 잘린 문장을 카드에 내보내지 않는다. 길이 초과는 생성 단계에서 재시도하고,
    // 기존/직접 입력 문구는 렌더러의 실제 폭 맞춤에 맡겨 원문을 끝까지 보존한다.
    const [head, tail] = splitHeadline(
      headline(card.title, Number.MAX_SAFE_INTEGER),
    );
    return pick({
      brand: product.short,
      title: head,
      highlight: tail,
      footer: product.handle,
    });
  }

  if (conceptId === "card") {
    if (role === "cover") {
      /**
       * 표지도 본문과 같은 배치다 — 위 알약에 후킹, 아래 흰 박스에 이 글이 다루는 것.
       *
       * ⚠️ **`product.summary`(상품 전반 소개)를 붙이지 않는다** (2026-08-13, 요청자 지시).
       *    주제가 무엇이든 표지 흰 박스 절반이 늘 같은 상품 소개로 채워졌다.
       *    요청자 지시: "한 글에 모든 상품에 대한 내용이 들어가는 게 아닌 주제에 대한 핵심만."
       */
      return pick({
        title: card.title,
        body: card.body,
        source: "",
        footer: product.handle,
      });
    }
    if (role === "outro") {
      return pick({
        body: `오늘의 내용이 도움이 됐다면?\n\n${product.short} 소식을 팔로우하고\n다음 이야기도 함께 보세요.`,
        footer: product.handle,
      });
    }
    return pick({
      title: card.title,
      body: summarizeForCard(card.body),
      source: "",
      footer: product.handle,
    });
  }

  // note — 표지에는 계정 핸들이 없다(피그마 그대로). 본문·팔로우에만 붙는다.
  if (role === "cover") {
    return pick({ title: card.title, body: product.tagline });
  }
  if (role === "outro") {
    return pick({
      body: `오늘의 내용이 도움이 됐다면?\n\n${product.short} 소식을 팔로우하고\n다음 이야기도 함께 보세요.`,
      footer: product.handle,
    });
  }
  // 정리 장(마무리 문장)도 같은 검정 박스 설명 배치를 쓴다 — 제목만 고정 문구로 구분한다.
  if (card.kind === "outro") {
    return pick({ title: "정리하면", body: card.body, footer: product.handle });
  }
  return pick({ title: card.title, body: card.body, footer: product.handle });
}
