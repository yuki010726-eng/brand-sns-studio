/**
 * 채널별 추천 글귀 생성기 (규칙 기반)
 *
 * 설계 원칙
 * 1. 데이터를 불릿으로 나열하지 않는다. product.voice 의 문장 재료를 골라 조합한다.
 * 2. 플랫폼마다 읽는 방식이 다르므로 구조를 공유하지 않는다.
 *    - 인스타: 첫 줄이 전부. 짧은 문단, 여백, 저장 유도.
 *    - 블로그: 검색으로 들어온 사람의 질문에 답하는 Q&A 구조. 제목에 키워드.
 *    - 쓰레드: 한 가지 이야기만. 구어체, 목록 없음, 질문으로 끝.
 * 3. 주제(topic)와 겹치는 문장을 앞으로 끌어올려 입력에 반응하게 만든다.
 * 4. variant 를 바꾸면 다른 후킹·근거 조합이 나온다 (재생성 버튼).
 *
 * 실제 AI 생성은 PART 2에서 이 파일의 generate() 만 교체하면 된다.
 *
 * 사실성 제약(07_BRAND_INFORMATION.md '공통 사실성 원칙')
 * - 마무리 문장은 product.closings(권장 표현)에서만 가져온다
 * - 종료된 행사는 쓰지 않는다 (status === 'open' 만)
 * - 성과·매출 보장, 최고·유일·1위 단정 문구를 만들지 않는다
 */

/** @typedef {{ product: object, topic: string, tone: string, variant?: number }} Ctx */

/** 톤 → 후킹 문장 인덱스. voice.hooks 는 이 순서(신뢰/후킹/담백/축하)로 작성돼 있다. */
const TONE_HOOK = { trust: 0, hook: 1, plain: 2, celebrate: 3 };

const TONE_LABEL = { trust: '신뢰·정보형', hook: '후킹·공감형', plain: '담백·실무형', celebrate: '축하·발표형', custom: '글 스타일 직접 추가' };

/** 순환 선택 — variant 를 올리면 다른 문장이 나온다 */
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

/**
 * 해시태그를 **글마다 다르게** 고른다 (2026-08-13, 요청자 승인).
 *
 * 예전에는 `p.hashtags` 5개를 늘 같은 순서로 통째로 붙였다. 어느 글이나 끝줄이 같아서
 * "폼이 똑같다"에 한몫했다. 이제 seed 로 시작점을 돌려 개수와 순서를 바꾼다.
 *
 * ⚠️ 태그 **문자열 자체는 만들지 않는다.** Supabase 상품 설정에 승인된 것만 쓴다
 *    — 지어내면 사실성 원칙에 걸리고 검색 유입에도 도움이 안 된다.
 * @param {string[]} tags 승인된 태그 목록
 * @param {number} seed  톤+variant
 * @param {number} n     쓸 개수
 */
/**
 * ⚠️ **대표 태그(첫 번째)는 늘 넣고, 나머지만 돌린다** (2026-08-14).
 *
 * 예전에는 목록 전체를 창처럼 잘라 썼다. 태그가 5개인데 인스타가 5개를 쓰니
 * **순서만 바뀌고 늘 같은 태그**가 나갔다("매번 다르게"라던 주석과 실제가 달랐다).
 * 목록을 14개로 늘리면서 방식도 바꾼다 — 브랜드로 찾아오는 길(대표 태그)은 끊지 않고,
 * 새로 들어올 사람이 검색하는 탐색 태그를 돌린다.
 */
/**
 * 태그용 씨앗 — **주제까지 넣는다** (2026-08-14).
 *
 * ⚠️ 톤+variant 만 쓰면 값이 0~4 다섯 가지뿐이라, 목록을 14개로 늘려도
 *    **뒤쪽 태그는 한 번도 안 나간다**(실측: 14개 풀에서 세 벌만 나왔다).
 *    게시물마다 달라지는 것은 주제이므로 주제를 씨앗에 넣는다.
 *    ⚠️ 결정적이어야 한다 — 같은 주제·톤이면 늘 같은 태그가 나와야 다시 열었을 때 글이 안 바뀐다.
 */
function tagSeed(core) {
  const key = `${core.topic}|${core.tone}|${core.variant}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function tagsFor(tags, seed, n) {
  const src = tags.filter(Boolean);
  if (!src.length) return '';
  const take = Math.min(n, src.length);
  const [lead, ...rest] = src;
  if (take <= 1 || !rest.length) return `#${lead}`;
  const start = ((seed % rest.length) + rest.length) % rest.length;
  const picked = Array.from({ length: take - 1 }, (_, i) => rest[(start + i) % rest.length]);
  return [lead, ...picked].map((t) => `#${t}`).join(' ');
}

/**
 * 주제와 겹치는 글자가 많은 문장을 앞으로 보낸다.
 * 한국어는 어미 변화가 많아 형태소 분석 없이 2-gram 겹침으로 대략의 관련도만 잡는다.
 */
function byTopic(items, topic, textOf = (x) => x) {
  topic = String(topic ?? '');
  const grams = new Set();
  const clean = topic.replace(/[^가-힣a-zA-Z0-9]/g, '');
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2));

  const score = (s) => {
    s = String(s ?? '');
    const c = s.replace(/[^가-힣a-zA-Z0-9]/g, '');
    let n = 0;
    for (let i = 0; i < c.length - 1; i++) if (grams.has(c.slice(i, i + 2))) n++;
    return n;
  };

  // 원래 순서를 최대한 지키면서 관련도가 높은 것만 끌어올린다
  return items
    .map((item, i) => ({ item, i, s: score(textOf(item)) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

/** 진행 예정 행사만 (종료된 일정을 모집 중처럼 쓰지 않기 위함) */
const openEvents = (p) => (p.events || []).filter((e) => e.status === 'open');

/** 공백·기호를 뺀 비교용 문자열 — 같은 사실이 두 번 들어가는 걸 막는다 */
const flat = (s) => String(s).replace(/[^가-힣a-zA-Z0-9]/g, '');

const gramsOf = (s) => {
  const c = flat(s);
  const out = new Set();
  for (let i = 0; i < c.length - 1; i++) out.add(c.slice(i, i + 2));
  return out;
};

/**
 * 두 문장이 사실상 같은 말인지 본다.
 *
 * 부분 문자열 비교로는 "…열릴 예정입니다" 와 "…열립니다" 를 다른 문장으로 봐서
 * 같은 사실이 두 번 실렸다. 한국어는 어미가 바뀌므로 2-gram 겹침 비율로 판단한다.
 * 짧은 쪽을 분모로 두어 '한 문장이 다른 문장에 거의 포함되는' 경우도 잡는다.
 */
function similarity(a, b) {
  const A = gramsOf(a);
  const B = gramsOf(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((g) => { if (B.has(g)) n++; });
  return n / Math.min(A.size, B.size);
}

const SAME_ENOUGH = 0.6;

/** 이미 쓴 문장과 내용이 겹치면 버린다 (같은 말을 반복하면 오히려 빈약해 보인다) */
function notAlreadySaid(sentence, used) {
  if (flat(sentence).length < 8) return false;
  return !used.some((u) => similarity(sentence, u) >= SAME_ENOUGH);
}

/**
 * 이미 말한 문장을 덜어낸다 (2026-08-13).
 *
 * 한계 단락(`voice.objection`)이 본문 항목과 거의 같은 말을 하는 경우가 있다.
 * 예) KCST — 본문 "심사가 매출 규모가 아니라 고객만족도 중심이라…" 과
 *     반론 "심사는 매출 규모가 아니라 고객만족도 중심으로 이뤄집니다." 가 사실상 같은 문장이다.
 * 그대로 두면 한 글에서 같은 말을 두 번 하게 되고, 요청자 지적("쓸데없는 내용")에 정면으로 걸린다.
 *
 * ⚠️ **전부 지워지면 안 된다.** 한계 단락은 광고로 안 읽히게 하는 장치라 반드시 남아야 한다.
 *    남는 문장이 없으면 원문을 그대로 돌려준다.
 */
function dropSaid(text, said) {
  const parts = String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return text;
  const kept = parts.filter((s) => notAlreadySaid(s, said));
  return kept.length ? kept.join(' ') : text;
}

/** 서로 겹치지 않는 것만 골라 n개 뽑는다 */
function pickDistinct(items, n, seed = []) {
  const out = [];
  const said = [...seed];
  for (const item of items) {
    if (out.length >= n) break;
    if (!notAlreadySaid(item, said)) continue;
    out.push(item);
    said.push(item);
  }
  return out;
}

/**
 * 카드뉴스 6장이 글의 어디에 들어가는지 표시한다.
 * 요청자 피드백: "생성된 이미지가 어디에 들어가는지" 알 수 없었다.
 * 대괄호 한 줄이라 붙여넣고 나서 지우기도 쉽다.
 *
 * 캡션은 레퍼런스 반영이다. 로라의 행복한상상 3편 모두 본문 이미지마다 한 줄 설명이 붙어 있고,
 * 그 문장이 카드에 적힌 문구를 그대로 요약한다. 캡션을 덱에서 뽑아 쓰면
 * **블로그 이미지와 인스타 카드가 같은 문구를 말하게 된다** — 세 채널 통일의 출발점이다.
 */
const imageSlot = (n, role, caption) =>
  `📷 [이미지 ${n} · ${role}] 카드뉴스 ${n}번을 여기에 넣으세요`
  + (caption ? `\n⤷ ${caption}` : '');

/**
 * 카드 한 장 → 이미지 아래 캡션 한 줄
 *
 * 레퍼런스의 캡션은 **설명**이지 제목이 아니다.
 *   "SBS 금·토드라마 '김부장' 넷플릭스에서도 시청 가능!"
 * 처음엔 카드 제목을 그대로 넣었더니 본문 소제목이 두 번 나왔다("수상하면 무엇을 받게 되나?").
 * 그래서 표지만 제목(후킹)을 쓰고, 나머지는 **본문 첫 문장**을 쓴다.
 */
const CAPTION_MAX = 60;

export function captionOf(card) {
  if (!card) return '';
  const first = String(card.body || '').split(/(?<=[.!?])\s+/)[0] || '';
  const source = card.kind === 'cover' || !first ? card.title : first;
  const text = String(source || '').replace(/\s+/g, ' ').trim();
  if (text.length <= CAPTION_MAX) return text;
  // 어절 중간에서 자르지 않는다 — 매거진형 제목 분할과 같은 원칙이다
  const cut = text.slice(0, CAPTION_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
}

/**
 * 소제목 표시 — 편집 화면에서도 의미가 드러나는 마크다운 2단계 제목을 쓴다.
 *
 * AI 경로(`lib/copyai.js` 의 `stripMarkdown()`)도 같은 표시로 맞춘다 —
 *    **한쪽만 고치면 규칙 기반 글과 AI 글의 모양이 달라진다.**
 */
export const HEAD_MARK = '##';

/**
 * 쉼표에서 줄을 쪼갤 문장인지 판단한다.
 *
 * ⚠️ **길이만 보고 쪼개면 안 된다.** 요청자 지적(2026-08-12):
 *    "고객만족도 30%, / 브랜드 신뢰도 25%, / …" 는 나눠도 읽기 편한데,
 *    "상장과 상패, / 인증서에 더해 네이버 플레이스 배너, / X배너, / 메탈 현판이 나옵니다."
 *    는 오히려 안 읽힌다. 차이는 **조각이 고르게 짧은 나열인지** 여부다.
 *    앞엣것은 조각이 7~11자로 고르고, 뒤엣것은 6자와 18자가 섞인 산문이다.
 *
 * 그래서 마지막 조각을 뺀 **모든** 조각이 짧을 때만 쪼갠다. 하나라도 길면 산문으로 본다.
 */
const LIST_ITEM_MAX = 12;   // 조각 하나의 글자 수 상한
const LIST_MIN_PARTS = 3;   // 이 개수 미만이면 나열이 아니라 그냥 쉼표다

function isEvenList(sentence) {
  const parts = sentence.split(/,\s*/);
  if (parts.length < LIST_MIN_PARTS) return false;
  // 마지막 조각은 "…로 심사합니다" 처럼 서술어가 붙어 길어지므로 재지 않는다
  return parts.slice(0, -1).every((x) => x.trim().length <= LIST_ITEM_MAX);
}

/**
 * 레퍼런스의 줄 리듬을 만든다 — **한 문장 = 한 줄.**
 *
 * 측정값(로라의 행복한상상 3편): 줄당 평균 27~29자, 30자 이하 짧은 줄이 59~71%.
 * 문단을 덩어리로 붙여 놓으면 네이버에서 읽을 때 벽처럼 보인다.
 *
 * ⚠️ 다만 **문장마다 빈 줄을 넣지는 않는다.** 전부 떼어 놓으면 문장이 따로 떠서
 *    무슨 말인지 안 읽힌다는 지적을 받았다(2026-08-12). 이어지는 문장 2~3개를
 *    한 덩어리로 묶고(줄바꿈만), 덩어리 사이에만 빈 줄을 둔다.
 */
const CHUNK_SENTENCES = 3;
const CHUNK_CHARS = 110;

function breathe(text) {
  const lines = String(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (isEvenList(s)
      ? s.split(/,\s*/).map((x, i, a) => (i === a.length - 1 ? x : `${x},`)).join('\n')
      : s));

  const chunks = [];
  let cur = [];
  let len = 0;
  for (const line of lines) {
    if (cur.length && (cur.length >= CHUNK_SENTENCES || len + line.length > CHUNK_CHARS)) {
      chunks.push(cur.join('\n'));
      cur = [];
      len = 0;
    }
    cur.push(line);
    len += line.length;
  }
  if (cur.length) chunks.push(cur.join('\n'));
  return chunks.join('\n\n');
}

/* ============================================================
   콘텐츠 코어 — 세 채널이 **같은 내용**을 말하게 하는 단 하나의 출처.

   요청자 요구(2026-08-03): "블로그·인스타·쓰레드 글의 내용이 동일해야 하며,
   동일한 이미지에서 각 플랫폼에 맞게 배포할 수 있어야 한다."

   예전에는 채널마다 따로 재료를 골랐다. 인스타는 qa 3개, 블로그는 4개, 쓰레드는
   threads.notes 를 따로 정렬했다. 그래서 같은 상품·주제인데도 다루는 사실이 서로 달랐다.

   지금은 buildCore() 가 **한 번만** 고르고, 세 생성기와 카드뉴스 덱이 전부 그 결과를 쓴다.
   ⚠️ 채널 생성기 안에서 byTopic()·pick() 으로 재료를 새로 고르지 말 것. 그 순간 다시 갈라진다.

   달라지는 것은 **형식과 화법**뿐이다 — 그게 '각 플랫폼에 맞게'의 의미다.
   ============================================================ */

/* ------------------------------------------------------------
   분량 계획 — 블로그는 원문이므로 장수와 무관하다 (2026-08-20 개정)

   ⚠️ 이 자리는 두 번 뒤집혔다. 순서를 알아야 또 뒤집지 않는다.

   ① (~2026-08-13) 장수와 무관하게 1,800~2,400자.
      요청자 지적: "한 섹션 내용이 너무 많아 안 읽힌다."
   ② (2026-08-13) 장수에 맞춰 소제목·분량을 함께 줄임 → 6장 800~1,100자·소제목 3개.
      요청자 지적(2026-08-20): "블로그 내용이 부족하다."
   ③ (2026-08-20) **총량은 ①로 돌리되, ①의 진짜 문제였던 '한 섹션이 길다'는 따로 푼다.**
      소제목을 3개 → 4개로 늘려 섹션을 잘게 쪼개고, 소제목당 문단 2~3개 × 3~5줄로 묶었다.
      즉 **글은 길어지되 한 번에 읽는 덩어리는 오히려 짧아진다.** 둘은 상충하지 않는다.

   블로그는 인스타·쓰레드·카드가 잘라 쓰는 **원문**이다(팩트시트 0-11). 원문이 얇으면 전부 얇아진다.

   ⚠️ `points` 는 카드뉴스 본문 장수보다 **적으면 안 된다.** deckFromCore() 가
      본문 카드마다 point 를 하나씩 꺼내 쓰기 때문이다.
      DECK_PLAN 본문 수: 1·2장→0, 3장→1, 4·5장→2, 6장→3. 아래 표는 전부 이를 만족한다.
   ------------------------------------------------------------ */
/**
 * ⚠️ **`min`·`max` 는 「본문」 기준이다 — 📷 이미지 자리와 ⤷ 캡션은 세지 않는다** (2026-08-14).
 *
 * 예전에는 글 **전체** 글자 수였다. 그런데 실측해 보니 완성된 글의 절반이 본문이 아니었다.
 *
 *   1,138자짜리 글 = 본문 570(50%) + 📷 199(17%) + ⤷ 캡션 157(14%) + 개요표·태그·소제목 212(19%)
 *
 * 📷 줄과 캡션은 **붙여넣고 나면 이미지로 바뀌거나 지워지는** 것이다. 그걸 글자 수에 넣고
 * "1,200~1,600자 안에 쓰라"고 시키니, 모델이 그만큼 본문을 스스로 깎았다.
 * 게다가 📷 줄 길이는 장수에 비례해 늘어나서 **장수가 늘수록 본문 예산이 조용히 줄었다.**
 *
 * ⚠️ **2026-08-20 개정 — 블로그 분량을 카드 장수에서 떼어냈다.**
 *
 * 예전에는 카드가 적으면 블로그도 짧아졌다(6장 800~1,100자 / 1장 600~850자, 소제목 2~3개).
 * 요청자 지적: "블로그 내용이 부족하다." 원인이 여기였다 —
 * **블로그가 카드에 종속돼 있었다.** 소제목 3개에 본문 1,100자면 소제목당 250자라
 * 논증이 들어갈 자리가 없다. 사실을 나열하다 끝난다.
 *
 * 이제 순서를 뒤집는다. **블로그가 원문이고 카드는 그 원문을 잘라 나르는 것이다**
 * (팩트시트 0-11 원문 우선 규정). 그래서 분량·소제목 수는 **장수와 무관하게 고정**이고,
 * 카드 장수는 **📷 이미지 자리 개수만** 정한다.
 *
 * ⚠️ 대신 카드를 1장만 골라도 블로그 토큰은 그대로 든다. 장수를 줄여 비용을 아끼던 효과가
 *    이미지 쪽에만 남는다. 비용이 문제가 되면 이 표의 min/max를 낮추면 된다 — 여기 한 곳만 고치면 된다.
 *
 * ⚠️ `points` 는 본문 카드 수(6장→3)보다 적으면 안 된다. 4는 전 장수에서 이를 만족한다.
 */
/**
 * ⚠️ **2026-08-20 2차 — 폭을 넓혔다.** 요청자: "쓸데없는 이야기를 안 적을 거면 글자를 좀 더 자유롭게 해도 된다."
 *    글자 수를 조인 것은 **짧은 글을 원해서가 아니라 군더더기가 늘어나서**였다.
 *    이제 군더더기는 도입 규칙과 고쳐 쓰기(`reviseDraft`)가 걷어내므로, 상한으로 막을 이유가 줄었다.
 *    하한은 "할 말이 있으면 이만큼은 나온다" 정도로만 두고, **상한은 여유롭게** 잡는다.
 */
const BLOG_PLAN = {
  1: { points: 4, min: 1300, max: 2600 },
  2: { points: 4, min: 1300, max: 2600 },
  3: { points: 4, min: 1300, max: 2600 },
  4: { points: 4, min: 1300, max: 2600 },
  5: { points: 4, min: 1300, max: 2600 },
  6: { points: 4, min: 1300, max: 2600 },
};

/**
 * 「본문」만 센다 — 붙여넣고 나면 사라지거나 이미지로 바뀌는 줄을 뺀다.
 * 화면 카운터(`pages/copy.js`)와 분량 계획이 **같은 정의**를 봐야 한다.
 */
export function bodyLength(text) {
  const kept = String(text).split('\n').filter((l) => {
    const t = l.trim();
    // ⚠️ **빈 줄은 남긴다.** 빈 줄까지 걷어내면 뺄 것이 하나도 없는 글에서도
    //    본문과 전체가 달라져, "둘이 같으면 한 숫자만" 하는 판단이 영영 안 맞는다.
    return !t || !(t === '───' || /^(📷|⤷|🔔|#\S)/.test(t));
  });
  return kept.join('\n').length;
}

/** 장수별 분량 계획. 프롬프트(copyai.js)와 규칙 기반이 **같은 표**를 본다. */
export const blogPlanFor = (size) => BLOG_PLAN[clampDeckSize(size)];

/** 규칙 기반 폴백에서 쓰는 핵심 개수. 카드뉴스 장수와 무관하다. */
export const pointsFor = (_size) => BLOG_PLAN[1].points;

/** @deprecated 장수와 무관하게 3개를 쓰던 시절의 값. `pointsFor(size)` 를 쓴다. */
const CORE_POINTS_MAX = 3;

/**
 * @param {Ctx} ctx
 * @returns {{hook:string, summary:string[], points:object[], extra:string|undefined,
 *            objection:string, closing:string, cta:string, events:object[]}}
 */
export function buildCore({ product: p, topic, tone, variant = 0, cardCount = DECK_SIZE }) {
  const v = p.voice;
  const size = clampDeckSize(cardCount);
  // 질문과 답을 쌍째로 정렬한다 — 따로 뽑으면 소제목과 본문이 어긋난다
  const points = byTopic(v.qa, topic, (x) => `${x.q} ${x.a}`).slice(0, pointsFor(size));

  const said = points.map((x) => x.a);
  const proof = byTopic(v.proof, topic);
  /**
   * 요약은 본문에서 이미 말한 것과 겹치지 않는 문장만 고른다.
   * ⚠️ 3줄 → 2줄로 줄였다(2026-08-13). 도입 앞에 3줄이 서면 본문을 읽기도 전에 지친다.
   */
  const summary = pickDistinct(proof, 2, said);
  // 어디에도 안 나온 사실이 남아 있으면 하나만 덧붙인다
  const extra = proof.find((s) => notAlreadySaid(s, [...said, ...summary]));

  return {
    product: p,
    topic,
    tone,
    variant,
    cardCount: clampDeckSize(cardCount),
    hook: pick(v.hooks, TONE_HOOK[tone] + variant),
    summary,
    points,
    extra,
    // 본문 항목과 겹치는 문장은 덜어낸다 — 같은 말을 두 번 하면 글이 빈약해 보인다
    objection: dropSaid(v.objection, [...said, ...summary]),
    /**
     * ⚠️ **씨앗에 톤을 더한다** (2026-08-14). `variant` 는 0·1 두 값뿐이라, 마무리 문장을
     *    5개로 늘려도 규칙 기반은 앞의 두 개만 계속 썼다. 후킹(`hooks`)이 이미
     *    `TONE_HOOK[tone] + variant` 로 도는 것과 같은 방식으로 맞춘다.
     *    (AI 경로는 목록 전체를 프롬프트에 주므로 모델이 직접 고른다 — 이 줄과 무관하다.)
     */
    closing: pick(p.closings, TONE_HOOK[tone] + variant),
    cta: pick(v.ctas, variant),
    events: openEvents(p),
  };
}

/* ============================================================
   인스타그램 — 첫 두 줄이 전부. 짧은 문단 + 여백 + 저장 유도.
   ============================================================ */
const NUM_MARK = ['①', '②', '③', '④', '⑤'];

/**
 * 요청자 피드백: 문장이 전부 '~습니다'로 끝나 리듬이 없고 읽히지 않았다.
 *
 * 사실 문장 자체는 손대지 않는다(사실성 원칙). 대신 **사이에 다른 종결을 끼워** 리듬을 만든다.
 * 질문(?) → 사실(습니다) → 질문(?) → 사실(습니다) 로 번갈아 가게 qa 쌍을 쓰고,
 * 문단 사이에 짧은 명사형 한 줄을 넣어 호흡을 끊는다.
 */
/**
 * 고정 문구를 풀로 바꿨다 (2026-08-13).
 * 예전에는 "'주제', 헷갈리는 것만 골랐어요." / "여기까지가 기본." / "📌 저장해 두면…" 세 줄이
 * **모든 글에 글자 그대로** 박혀 있었다. 요청자 지적: "내용이랑 폼이 너무 똑같아."
 */
const IG_SUBS = [
  (t) => `'${t}', 헷갈리는 것만 골랐어요.`,
  (t) => `'${t}' 알아보다 정리한 내용이에요.`,
  (t) => `'${t}', 자주 묻는 것만 짚었습니다.`,
  (t) => `'${t}' 짧게 정리해 봤어요.`,
];
const IG_SAVES = [
  '📌 저장해 두면 필요할 때 바로 찾습니다.',
  '📌 나중에 볼 것 같으면 저장해 두세요.',
  '📌 필요하실 때 꺼내 보시라고 남겨둡니다.',
];

function instagramCopy(core) {
  const { product: p, topic, tone, variant, hook, points, objection, closing, cta } = core;
  const seed = TONE_HOOK[tone] + variant;

  /**
   * ⚠️ `extra` 와 "여기까지가 기본." 을 뺐다 (2026-08-13).
   *    핵심 3가지 밖의 사실을 하나 더 붙이면 각도가 흐려지고 길어지기만 한다.
   *    요청자 지시: "글 내용을 핵심만 하고 쓸데없는 내용은 줄여줘."
   */
  const blocks = [
    /**
     * '더보기' 전에 보이는 자리. 여기서 끌지 못하면 나머지는 안 읽힌다.
     * ⚠️ 둘째 줄은 **주제에 대한 답**이다(2026-08-13). 예전에는 "'주제', 헷갈리는 것만 골랐어요."
     *    같은 안내 문구여서, 두 줄을 다 읽어도 주제에 대한 답이 하나도 없었다.
     */
    `${hook}\n${core.answer || pick(IG_SUBS, seed)(topic)}`,

    // 블로그 소제목·카드뉴스 본문과 같은 항목이다
    ...points.map((x, i) => `${NUM_MARK[i]} ${x.q}\n${x.a}`),

    objection,
    closing,

    // 저장 유도는 유지한다 (요청자 지시 2026-08-13) — 인스타에서 저장은 노출로 이어진다
    `${pick(IG_SAVES, seed)}\n${cta}\n${p.handle}`,
    `.\n.\n.\n${tagsFor(p.hashtags, tagSeed(core), 5)}`,
  ];

  /**
   * ⚠️ 인스타는 **짧아야 읽힌다** (요청자 지적 2026-08-13).
   *    인기 정보 계정 캡션은 400자 안팎이다. AI 프롬프트도 같은 기준(500자)을 지시하므로
   *    규칙 기반도 같은 선에서 끊는다 — 한쪽만 길면 두 경로의 결과가 따로 논다.
   *    clampToLimit 은 문단 단위로 뒤에서 덜어내되 마지막 두 덩어리(계정·해시태그)는 남긴다.
   */
  return clampToLimit(blocks.filter(Boolean).join('\n\n'), 520);
}

/* ============================================================
   쓰레드 — 공지가 아니라 '알게 된 걸 흘리는' 글.
   여기서만 화법이 다르다: 발견형 도입 → 흘리는 정보 → 한발 물러선 단서 →
   권유 없는 마무리. 해시태그·계정·CTA를 넣지 않는 것이 핵심이다.
   (넣는 순간 광고 티가 나서 이 톤이 무너진다.)
   ============================================================ */
/**
 * 왜 읽어야 하는지를 첫 줄에서 만든다.
 *
 * 요청자 피드백: "읽어보고 사실 별로 궁금하지 않다. 이걸 왜 읽어야 하는지 후킹이 없다."
 * 공지 톤으로 넘어가지 않으면서 읽을 이유를 주려면 '정보의 빈자리'를 짚어야 한다.
 * 아래 문장들은 사실 주장이 아니라 화자의 경험·태도라서 사실성 원칙에 걸리지 않는다.
 */
const THREAD_HOOKS = [
  (topic) => `'${topic}' 찾아봤는데 한군데 정리된 데가 없더라고요.`,
  (topic) => `${topic} 관련해서 잘못 알고 있던 게 하나 있었어요.`,
  (topic) => `이거 모르고 지나가면 좀 아까울 것 같아서 적어둡니다.`,
  (topic) => `'${topic}' 이거 생각보다 조건이 단순하더라고요.`,
];

/** 질문형 마무리 — 대화가 이어지게 한다. 채널 정의의 '질문형 마무리'와 짝을 이룬다. */
const THREAD_QUESTIONS = [
  '혹시 이미 해보신 분 있나요?',
  '이런 거 미리 챙기시는 편인가요?',
  '더 아는 분 있으면 알려주세요.',
];

/**
 * 코어의 핵심 3가지를 **구어체 재료로 바꿔** 온다.
 *
 * 쓰레드만 화법이 다르다(`voice.threads`). 그렇다고 notes 를 주제로 따로 정렬해 버리면
 * 다른 채널과 다루는 사실이 갈라진다 — 실제로 그랬다.
 * 그래서 **코어가 고른 질문·답과 가장 가까운 note** 를 찾아 붙인다.
 * 같은 사실을 말하되 말투만 구어체가 된다.
 */
/**
 * ⚠️ 관련 없는 note 를 억지로 붙이지 않는다.
 *
 * 처음엔 가장 가까운 note 를 무조건 하나씩 골랐다. 그랬더니 핵심이 '받은 다음 어디에 쓰나요'인데
 * 쓰레드는 '방송사가 직접 여는 브랜드어워즈'를 말했다 — notes 에 그 항목이 아예 없어서다.
 * 어긋난 걸 말하느니 **그 항목을 빼는 게 낫다.** 쓰레드는 원래 500자라 다 담지도 못한다.
 */
const NOTE_MATCH_MIN = 0.2;

function threadNotesFor(core) {
  const notes = core.product.voice.threads.notes;
  const used = [];
  for (const pt of core.points) {
    const target = `${pt.q} ${pt.a}`;
    const best = notes
      .filter((n) => !used.includes(n))
      .map((n) => ({ n, s: similarity(n, target) }))
      .sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= NOTE_MATCH_MIN) used.push(best.n);
  }
  return used;
}

function threadsCopy(core) {
  const { product: p, topic, tone, variant } = core;
  const t = p.voice.threads;

  const draft = [
    // 후킹 → 발견형 도입 순서. 후킹이 없으면 그냥 흘러가는 글이 된다.
    pick(THREAD_HOOKS, TONE_HOOK[tone] + variant)(topic),
    pick(t.opens, TONE_HOOK[tone] + variant),
    threadNotesFor(core).join('\n'),
    t.hedge,
    `${pick(t.closes, variant)}\n${pick(THREAD_QUESTIONS, variant)}`,
  ].join('\n\n');

  /**
   * ⚠️ 500 → 300 (2026-08-14, 요청자 지시: "글이 너무 많다").
   *    `CHANNELS` 의 limit·`channelRules()` 의 프롬프트 지시와 **같은 숫자**여야 한다.
   *    clampToLimit 은 뒤에서 문단째 덜어내되 마지막 질문은 남긴다 — 쓰레드는 질문으로 끝난다.
   */
  return clampToLimit(draft, 300);
}

/* ============================================================
   블로그 — 레퍼런스(네이버 블로그 4편) 골격을 그대로 따른다.

   측정해서 확인한 공통 구조 (로라의 행복한상상 3편이 오차 없이 동일):
     제목 두 줄 → 구분선 → 인용구 요약 → 도입 → 이미지+캡션
     → 소제목/본문 6묶음(사이사이 이미지+캡션) → 개요표 → 해시태그

   ⚠️ 목차를 넣지 않는다. 레퍼런스 3편 모두 목차가 없다. 예전 구조에는 있었다.

   ⚠️ **레퍼런스에서 가져온 것은 레이아웃과 이미지 구성뿐이다. 문체는 가져오지 않는다.**
      한 번 레퍼런스의 '~다' 평서형까지 옮겼다가 되돌렸다(2026-08-03).
      상품을 **소개하는** 글인데 말끝마다 '~다'로 끊으니 읽는 사람에게 설명하는 느낌이 사라졌다.
      문체는 **읽는 사람에게 설명하듯 하는 존댓말**이다. voice 재료를 원문 그대로 쓰면 된다.
   ============================================================ */
/**
 * 도입 첫 줄 — 글마다 달라야 한다. 전부 화자의 태도라 사실 주장이 아니다.
 * 짝은 `lib/copyai.js` 의 블로그 규칙 4)번이다 — 한쪽만 고치면 규칙 기반과 AI 글의 결이 갈린다.
 */
/**
 * 제목 윗줄 — 검색어 줄.
 *
 * ⚠️ 예전에는 `${p.short} ${topic}` 한 줄이었다. 두 가지가 눈에 띄게 어설펐다.
 *   ① 주제에 이미 상품명이 들어 있으면 **두 번 찍혔다** —
 *      주제 『KBS N 브랜드어워즈 특전』 → "KBS N KBS N 브랜드어워즈 특전"
 *   ② 담당자가 급하게 적은 대로 소문자가 그대로 제목에 박혔다 —
 *      주제 『ai 홍보 영상 신청 방법』 → "KBS N ai 홍보 영상 신청 방법"
 *
 * ⚠️ **담당자가 쓴 말을 고쳐 쓰지는 않는다.** 손대는 것은 두 가지뿐이다 —
 *    중복 제거와 **아는 약어의 대소문자**. 아래 목록에 있는 것만 올린다.
 *    (주제를 바꿔 해석하는 일은 `lib/outline.js` 가 하고, 여기는 표기만 만진다.)
 */
const ACRONYMS = ['AI', 'TV', 'CF', 'IPTV', 'KBS', 'KBSN', 'ESG', 'CSV', 'KCST', 'SNS'];

/** 낱말로 선 약어만 대문자로. 한국어가 붙어 있어도(`ai영상`) 잡히고, 낱말 속(`aircraft`)은 안 잡힌다. */
function fixAcronyms(text) {
  return ACRONYMS.reduce(
    (s, a) => s.replace(new RegExp(`(^|[^A-Za-z])(${a})(?![A-Za-z])`, 'gi'), (_, pre) => `${pre}${a}`),
    String(text),
  );
}

export function blogTitle(short, topic) {
  const t = fixAcronyms(String(topic).replace(/\s+/g, ' ').trim());
  const flat = (s) => s.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
  // 주제가 이미 상품 이름을 담고 있으면 앞에 또 붙이지 않는다
  return flat(short) && flat(t).includes(flat(short)) ? t : `${short} ${t}`;
}

/**
 * '구체'로 볼 만한 표시. 숫자가 기본이고, 숫자는 없지만 조건·범위를 못박는 승인된 표현을 함께 본다.
 * ⚠️ 여기에 형용사("우수한", "다양한")를 넣지 말 것 — 그건 구체가 아니라 수식이다.
 */
const CONCRETE_MARK = /\d|전\s*업종|연중\s*상시|비대면|무상|시·군·구|전국|모든\s*업종/;

/**
 * 이 문단에 붙일 근거 한 줄을 고른다. 없으면 빈 문자열.
 * 문단 내용과 가장 가까운 것부터 보되, **구체가 든 문장**만 쓰고 이미 말한 것은 건너뛴다.
 */
function concreteFor(point, pool, said) {
  const target = `${point.q} ${point.a}`;
  for (const s of byTopic(pool, target)) {
    if (!CONCRETE_MARK.test(s)) continue;
    if (!notAlreadySaid(s, said)) continue;
    return s;
  }
  return '';
}

const BLOG_LEADS = [
  (t) => `'${t}' 찾아보면 여기저기 흩어져 있더라고요.`,
  (t) => `'${t}', 막상 알아보려니 어디부터 봐야 할지 애매하시죠.`,
  (t) => `'${t}' 관련해서 자주 받는 질문만 모았습니다.`,
  (t) => `'${t}' 이거, 생각보다 헷갈리는 지점이 있습니다.`,
];

function blogCopy(core) {
  const { product: p, topic, points, summary: summary3, objection, closing, events } = core;
  const v = p.voice;
  const deck = deckFromCore(core, core.cardCount);   // 캡션을 카드에서 가져온다 — 인스타 카드와 같은 문구가 된다

  /**
   * 이미지 자리는 **장수에 따라 줄어든다.** 글은 그대로다.
   * 요청자 지시: "이미지를 줄이더라도 내용은 기승전결이 잘 드러나도록."
   * 그래서 소제목·반론·정리 단락은 장수와 무관하게 늘 쓰고, 📷 줄만 있는 장에 붙인다.
   */
  const labels = roleLabels(core.cardCount);
  const slotAt = (kind, nth = 0) => {
    let seen = 0;
    for (let i = 0; i < labels.length; i++) {
      const k = deck[i]?.kind;
      if (k !== kind) continue;
      if (seen++ !== nth) continue;
      return `

${imageSlot(i + 1, labels[i], captionOf(deck[i]))}`;
    }
    return '';
  };

  /**
   * 제목을 두 줄로 세운다. 레퍼런스 3편 모두 소제목 블록 두 개로 제목을 쪼개 놓았다.
   * 윗줄은 검색어(상품 + 주제), 아랫줄은 후킹구다.
   *   "김부장넷플릭스 공개시간 몇 시?" / "소지섭 액션이 돌아왔다"
   */
  /**
   * ⚠️ 따옴표는 **글 전체가 감싸인 경우에만** 벗긴다 (2026-08-13).
   *    예전에는 앞뒤 따옴표를 무조건 지워서, 안에 인용이 든 후킹
   *    『"소상공인도 신청할 수 있나요?" — 전 업종 가능합니다.』 의 여는 따옴표만 사라지고
   *    닫는 따옴표가 홀로 남았다. 제목 두 번째 줄이 깨져 보이던 원인이다.
   */
  const rawHook = String(core.hook).replace(/^[\s📢]+/, '').trim();
  const hook = /^"[^"]*"$/.test(rawHook) || /^'[^']*'$/.test(rawHook)
    ? rawHook.slice(1, -1).trim()
    : rawHook;
  const titleTop = blogTitle(p.short, topic);

  /**
   * 도입 — 목차 대신 '왜 지금 이걸 보는가'로 연다.
   * 아래 두 줄은 사실 주장이 아니라 화자의 태도라서 사실성 원칙에 걸리지 않는다.
   * (쓰레드 후킹에서 이미 같은 논리로 승인받은 방식이다.)
   *
   * 제목이 바로 위에 있으므로 주제를 다시 되뇌지 않는다. 레퍼런스도 도입에서 제목을 반복하지 않는다.
   */
  /**
   * ⚠️ **도입을 한 문장으로 고정하지 않는다** (2026-08-13).
   *    예전에는 "찾아보면 여기저기 흩어져 있어서…" 한 줄이 **모든 글에 그대로** 박혔다.
   *    요청자 지적: "지금 내용이랑 폼이 너무 똑같아."
   *    주제·톤·variant 로 갈리는 풀에서 뽑는다. 사실 주장이 아니라 화자의 태도라 사실성 원칙에 걸리지 않는다.
   *
   * ⚠️ `p.summary` 를 붙이지 않는다. 상품 전반 소개라 주제에서 벗어나고 도입만 길어졌다.
   */
  /**
   * ⚠️ **주제에 대한 답이 있으면 그것부터 준다** (2026-08-13, 요청자 지시).
   *    요청자 지적: "『IPTV 지역 타겟팅이란』이라고 했으면 일단 지역 타겟팅에 대한 설명을 하고 해야지."
   *    도입 한 줄은 화자의 태도라 어느 글에나 붙는데, 그것만 있으면 **답이 소제목까지 밀린다.**
   *    뼈대(`lib/outline.js` 의 `answer`)가 있으면 도입 둘째 줄에 답을 세운다.
   *    규칙 기반 단독 경로에는 `answer` 가 없으므로 예전 도입 그대로 나간다.
   */
  const lead = breathe([
    pick(BLOG_LEADS, TONE_HOOK[core.tone] + core.variant)(topic),
    core.answer || '필요한 것만 골라 봤습니다.',
  ].join(' '));

  /**
   * 소제목은 **코어의 핵심 3가지**다. 인스타 ①②③, 카드뉴스 2~4번과 같은 항목이다.
   *
   * 블로그는 길이가 허용되므로 각 문단에 관련 근거를 한 줄씩 덧대 살을 붙인다.
   * 다루는 항목은 그대로고 설명만 길어지는 것이라 채널 간 내용이 갈라지지 않는다.
   * 이미 답에 들어간 내용이면 붙이지 않는다 — 같은 말을 두 번 하면 오히려 빈약해 보인다.
   */
  /**
   * ⚠️ **근거 한 줄을 다시 붙인다** (2026-08-14). 2026-08-13 에 뺐던 것을 되살리되 **조건을 걸었다.**
   *
   * 뺀 이유는 "한 섹션 내용이 너무 많다"였는데, 실측해 보니 덜어낸 것이 군더더기가 아니라
   * **근거**였다. 상품마다 사실이 12~16개인데 글에 1~7개만 나갔고, 남은 문단은
   * "가능합니다 / 연결됩니다" 뿐인 기능 설명이 됐다(요청자 지적 2026-08-14).
   *
   * 그래서 예전처럼 무조건 붙이지 않는다. **구체(숫자·기간·조건)가 든 문장만, 문단당 하나만,
   * 이미 말한 것과 겹치지 않을 때만** 붙인다. 문단은 한 줄 늘고 알맹이가 생긴다.
   */
  const said = [...points.map((x) => x.a), ...summary3];
  const sections = points
    .map((pt, i) => {
      const proofLine = concreteFor(pt, v.proof || [], said);
      if (proofLine) said.push(proofLine);
      const body = proofLine ? `${pt.a} ${proofLine}` : pt.a;
      return `${HEAD_MARK} ${pt.q}\n\n${breathe(body)}${slotAt('body', i)}`;
    })
    .join('\n\n');

  /**
   * 개요표 — **짧은 글에는 넣지 않는다** (2026-08-13, 요청자 승인).
   *
   * 레퍼런스의 🔔 표를 옮긴 것인데, 어느 글에나 같은 5줄이 붙어서 "폼이 똑같다"의
   * 절반을 차지했다. 게다가 800자짜리 글 끝에 붙으면 본문 대비 비중이 너무 크다.
   * 스캔하고 나가는 독자를 위한 장치이므로 **읽을 거리가 있는 긴 글(4장 이상)에서만** 쓴다.
   * 줄도 꼭 필요한 것만 남긴다 — 상품·접수·문의. 일정은 열린 행사가 있을 때만.
   */
  const factBox = core.cardCount >= 4 ? [
    `🔔 상품 · ${p.name}`,
    `🔔 접수 · ${p.intake}`,
    events.length ? `🔔 일정 · ${events.map((e) => `${e.date} ${e.name}`).join(' / ')}` : '',
    `🔔 문의 · ${p.handle}`,
  ].filter(Boolean).join('\n') : '';

  return [
    titleTop,
    hook,
    '',
    '───',
    '',
    summary3.map((s) => `> ${s}`).join('\n'),
    '',
    lead,
    slotAt('cover').trim() ? slotAt('cover').trim() : '',
    '',
    sections,
    '',
    /**
     * ⚠️ **조건 문장에 소제목을 주지 않는다** (2026-08-20, 요청자 지시:
     *    "단점을 두드러지게 표현하지 말아줘. 차라리 돌려 말하든지").
     *
     * 예전에는 `## ${objectionHead}` 로 **소제목 한 칸을 통째로** 내줬다. 소제목은 훑어보는
     * 자리라, 글을 다 읽지 않는 사람에게는 「원하는 날짜에 바로 나가진 않아요」만 남았다.
     * 지금은 소제목 없이 마무리 단락 바로 위에 한 줄로 붙인다 — **문장 자체는 지우지 않았다**
     * (사실성 원칙 4번). 없애는 게 아니라 자리를 낮춘 것이다.
     * ⚠️ `objectionHead` 는 카드에서 계속 쓴다(`deckFromCore`). 여기서만 안 쓴다.
     */
    breathe(objection),
    slotAt('note').trim() ? `
${slotAt('note').trim()}` : '',
    '',
    /**
     * ⚠️ 마무리 이미지는 **마무리 단락 앞**에 둔다 (2026-08-13).
     *
     * 예전에는 접수 안내 뒤, 즉 글의 맨 끝에 붙었다. 카드가 2장이면 표지(맨 위)와
     * 마무리(맨 아래)만 남아 **본문 안에는 이미지가 하나도 없었다.**
     * 요청자 지적: "블로그 이미지는 중간 해당되는 부분에 넣어야지 처음에 만들고
     * 마지막에 넣고 끝낼 리가 없잖아."
     * 앞으로 옮기면 글이 이미지가 아니라 문장으로 끝나기도 한다.
     */
    slotAt('outro').trim() ? `${slotAt('outro').trim()}
` : '',
    '',
    `${HEAD_MARK} ${core.closingHead || '정리하면'}`,
    '',
    closing,
    '',
    // ⚠️ 구체 금액은 쓰지 않는다. 다만 "비용은 상담 시 안내드립니다"는 허용한다 (2026-08-14 개정).
    //    막는 것은 금액과 가격 주장('저렴한'·'가성비')이지 비용이라는 주제 자체가 아니다.
    `접수는 '${p.intake}'입니다. 일정과 접수 상태는 달라질 수 있으니 신청 전에 공식 채널에서 확인해 주세요.`,
    '',
    factBox,
    '',
    // 블로그는 3개면 충분하다. 5개를 늘 같은 순서로 붙이면 끝줄이 매번 같아진다.
    tagsFor(p.hashtags, tagSeed(core), 3),
  ].filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n');
}

/**
 * 글자 수 제한을 넘으면 문단 단위로 덜어낸다.
 * 문장을 중간에서 자르지 않으므로 문맥이 깨지지 않는다.
 */
function clampToLimit(text, limit) {
  if (text.length <= limit) return text;
  const blocks = text.split('\n\n');
  while (blocks.length > 2 && blocks.join('\n\n').length > limit) {
    blocks.splice(blocks.length - 2, 1);   // 마지막 질문은 남긴다
  }
  const out = blocks.join('\n\n');
  return out.length <= limit ? out : out.slice(0, limit - 1).trimEnd() + '…';
}

/* ============================================================
   카드뉴스 6장 — **콘텐츠 코어와 같은 항목**을 쓴다.
   1장 후킹 → 2~4장 핵심 3가지 → 5장 반론 → 6장 마무리.
   이 한 벌을 블로그 본문·인스타 캐러셀·쓰레드 표지에 나눠 쓴다 (IMAGE_PLAN 참고).
   ============================================================ */

export const DECK_SIZE = 6;
export const DECK_MIN = 1;
export const DECK_MAX = 6;

/** 장수를 그 범위 안으로 밀어 넣는다 */
export const clampDeckSize = (n) => Math.min(DECK_MAX, Math.max(DECK_MIN, Math.round(Number(n) || DECK_SIZE)));

/**
 * 장수별 카드 구성.
 *
 * 요청자 요구(2026-08-03): API 비용을 줄이려고 1~6장을 고를 수 있어야 한다.
 * **장수를 줄여도 기승전결은 남아야 한다.** 그래서 본문(body)부터 덜어내고
 * 표지(기)와 마무리(결)는 끝까지 지킨다. 반론(전)은 5장부터 들어온다.
 *
 *   1장  표지                              — 한 장에 후킹과 마무리를 함께 얹는다
 *   2장  표지 · 마무리
 *   3장  표지 · 본문1 · 마무리
 *   4장  표지 · 본문1 · 본문2 · 마무리
 *   5장  표지 · 본문1 · 본문2 · 반론 · 마무리
 *   6장  표지 · 본문1 · 본문2 · 본문3 · 반론 · 마무리
 */
const DECK_PLAN = {
  1: ['cover'],
  2: ['cover', 'outro'],
  3: ['cover', 'body', 'outro'],
  4: ['cover', 'body', 'body', 'outro'],
  5: ['cover', 'body', 'body', 'note', 'outro'],
  6: ['cover', 'body', 'body', 'body', 'note', 'outro'],
};

/** 장수에 맞는 역할 목록 — 블로그 이미지 자리 라벨도 여기서 나온다 */
export const deckPlan = (size) => DECK_PLAN[clampDeckSize(size)];

const ROLE_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리' };
export const roleLabels = (size) => deckPlan(size).map((k) => ROLE_LABEL[k]);

/** 코어에서 카드를 만든다. 블로그 캡션도 여기서 나온다. */
function deckFromCore(core, size = DECK_SIZE) {
  const { product: p, topic, hook, points, objection } = core;
  // 마무리 문구가 비어 저장된 기존 outline도 화면을 다시 열면 즉시 복구한다.
  const closing = core.closing || pick(p.closings || [], core.variant ?? 0);
  // 마무리 카드 제목에 쓸 행동 유도 한 줄. AI 뼈대에 없으면 승인된 목록에서 고른다.
  const cta = core.cta || pick(p.voice?.ctas || [], 0);
  /**
   * 표지·반론·마무리 장면. **AI 뼈대가 만든 것이 있으면 그것을 쓴다** (2026-08-13).
   * 예전에는 `p.voice.shots` 고정값만 봐서 주제를 바꿔도 그림이 늘 같았다 — 요청자 지적.
   * `mergeCore()` 가 `core.shots` 에 담아 준다. 규칙 기반 경로에는 없으므로 데이터로 떨어진다.
   */
  const shots = { ...(p.voice.shots || {}), ...(core.shots || {}) };
  const plan = deckPlan(size);
  const total = plan.length;
  const pad = (n) => String(n).padStart(2, '0');

  // 한 장뿐이면 마무리 카드가 없다. 표지가 마무리까지 안고 가야 기승전결이 산다.
  const soloCover = total === 1;

  let bodyIdx = 0;
  return plan.map((kind, i) => {
    /**
     * 카드 번호 배지. 매거진형은 상단 중앙에 계정명(`brand`)이 따로 있으므로
     * 여기에 브랜드명을 또 넣으면 **같은 글자가 한 카드에 두 번** 보인다.
     *
     * ⚠️ 예전에는 표지·마무리만 `p.short` 였다(2026-08-20 이전). 그래서 번호가
     *    01/06 → 02/06 … 로 가다가 **마지막만 「포브스」로 튀었다**(요청자 지적).
     *    번호는 전 장에 일관되게 붙인다. 한 장짜리일 때만 번호가 뜻이 없어 브랜드명을 쓴다.
     */
    const eyebrow = total > 1 ? `${pad(i + 1)} / ${pad(total)}` : p.short;

    if (kind === 'cover') {
      return {
        kind: 'cover',
        eyebrow,
        title: hook,
        body: soloCover ? `${topic}\n${closing}` : topic,
        footer: p.handle,
        shot: shots.cover,
      };
    }
    if (kind === 'body') {
      const x = points[bodyIdx++] || points[points.length - 1];
      return { kind: 'body', eyebrow, title: x.q, body: x.a, footer: p.short, shot: x.shot };
    }
    if (kind === 'note') {
      return {
        kind: 'note', eyebrow, title: core.objectionHead || '그래도 망설여진다면',
        body: objection, footer: p.short, shot: shots.note,
      };
    }
    return {
      /**
       * ⚠️ **마무리 카드 제목은 '행동 유도'다. 마무리 문장이 아니다** (2026-08-20 개정).
       *
       * 예전에는 `title: closing` 이었다. 그런데 승인된 마무리 문장은 **31~55자**이고
       * 매거진형 제목 칸은 **16자**다. `defaultsFor()` 가 그대로 잘라서
       * 「중앙일보 연합광고와 포브스…」 같은 **뜻이 끊긴 조각**이 카드에 찍혔다(요청자 지적).
       * 「자르지 않는다」는 주석이 있었지만 `clampSlot()` 이 실제로는 자르고 있었다.
       *
       * 마무리 카드에서 독자가 알아야 할 것은 **다음에 뭘 하면 되는지**다.
       * 그래서 제목에는 승인된 CTA(23~32자, 두 줄에 들어간다)를 쓰고,
       * 마무리 문장은 **본문 칸이 있는 템플릿**(카드형·노트형)에서 본문으로 보여 준다.
       * ⚠️ 매거진형에는 본문 칸이 없다. 거기서는 CTA 만 남는 게 맞다 — 잘린 문장보다 낫다.
       */
      kind: 'outro',
      eyebrow,
      title: cta || closing,
      body: `${closing}\n접수 방식은 '${p.intake}'입니다.`,
      footer: p.handle,
      shot: shots.outro,
    };
  });
}

/**
 * @param {Ctx} ctx
 * @returns {Array<{kind:string, eyebrow:string, title:string, body?:string, footer?:string}>}
 */
export function buildDeck(ctx) {
  /**
   * ⚠️ `ctx.core` 가 오면 그것을 쓴다. AI 가 주제로 짠 뼈대(`lib/outline.js`)를 넣기 위한 자리다.
   *    이게 없던 시절에는 카드 문구가 **항상 규칙 기반**이라, AI 가 글을 새로 써도
   *    카드뉴스는 그대로였다 — 요청자 지적 그대로였다.
   */
  const core = ctx.core || (ctx.allowRuleFallback
    ? buildCore({ ...ctx, variant: ctx.variant ?? 0 })
    : null);
  if (!core?.fromAI && !ctx.allowRuleFallback) {
    throw new Error('AI로 생성한 주제 뼈대가 필요합니다.');
  }
  return deckFromCore(core, ctx.cardCount);
}

const GENERATORS = { blog: blogCopy, instagram: instagramCopy, threads: threadsCopy };

/**
 * @param {'blog'|'instagram'|'threads'} channelId
 * @param {Ctx} ctx
 * @returns {string}
 */
export function generate(channelId, ctx) {
  const fn = GENERATORS[channelId];
  if (!fn) throw new Error(`알 수 없는 채널: ${channelId}`);
  // ⚠️ 세 채널이 같은 ctx 를 받으면 같은 코어가 나온다. 이게 내용 통일의 전부다.
  /**
   * ⚠️ `ctx.core` 가 오면 그것을 쓴다 — `buildDeck()` 과 같은 규칙이다.
   *    예전에는 여기서 **항상 코어를 새로 만들어** AI 가 지은 소제목(objectionHead 등)을 무시했다.
   *    그러면 같은 게시물인데 카드와 블로그의 소제목이 서로 달라진다.
   */
  const out = fn(ctx.core || buildCore({ ...ctx, variant: ctx.variant ?? 0 }));
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 금지 표현 검사 — 편집 중에도 매 입력마다 호출되므로 동기 함수로 유지한다.
 * 띄어쓰기 차이를 흡수하려고 공백을 제거한 문자열끼리 비교한다.
 * @param {string} text
 * @param {string[]} banned
 * @returns {string[]} 발견된 금지 표현
 */
export function findBanned(text, banned) {
  const flat = text.replace(/\s/g, '');
  return banned.filter((phrase) => flat.includes(phrase.replace(/\s/g, '')));
}

export { TONE_LABEL };
