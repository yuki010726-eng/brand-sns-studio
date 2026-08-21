/**
 * 블로그 스타일 — 모아 둔 글 스타일을 다루는 공용 규칙.
 *
 * 예전 이름은 「문체 스타일」이었다. 2026-08-20 요청자 지시로 **화면에 보이는 말을
 * 「블로그 스타일」로 통일**했다. 저장 키(`state.styles` · `state.styleId`)는 그대로 둔다 —
 * 이름만 바뀐 것이라 이미 저장된 값을 옮길 이유가 없다.
 *
 * 이 파일이 있는 이유: 「설정 화면(/research)」과 「2단계 고르기(/copy)」가 **같은 이름표와
 * 같은 요약**을 보여줘야 하기 때문이다. 한쪽에서만 A타입이라고 부르면 고를 때 헷갈린다.
 */

/**
 * 목록에서 몇 번째인지를 눈에 띄는 이름표로 바꾼다 — A타입 · B타입 …
 * 스타일은 최대 12개까지 쌓이므로(`pages/research.js` 의 slice) 글자도 12개면 충분하다.
 */
const LETTERS = 'ABCDEFGHIJKL';
export const typeLetter = (i) => LETTERS[i] ?? String(i + 1);
export const typeLabel = (i) => `${typeLetter(i)}타입`;

/** 이름 입력 상한 — 저장할 때(연구 화면)와 이름을 고칠 때가 같아야 한다 */
export const NAME_MAX = 20;

/**
 * 분석 결과(`guide`)를 항목으로 쪼갠다.
 *
 * 분석 프롬프트(`pages/research.js`)가 1~7 번호를 붙여 달라고 시키지만, 모델은
 * `**1. 도입 방식**` · `1) 도입 방식:` 처럼 조금씩 다르게 쓴다. 그래서 번호만 보고 끊는다.
 * 못 쪼개면 통째로 한 항목으로 돌려준다 — 화면이 비는 것보다 낫다.
 *
 * @param {string} guide
 * @returns {Array<{label:string, body:string}>}
 */
export function sectionsOf(guide) {
  const text = String(guide || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  const out = [];
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const hit = line.match(/^(\d{1,2})\s*[.)]\s*(.+)$/);
    if (hit) {
      // 「제목: 내용」이면 콜론 앞을 이름표로 쓴다. 콜론이 없으면 줄 전체가 이름표다.
      const rest = hit[2].trim();
      const cut = rest.indexOf(':');
      const label = (cut > 0 ? rest.slice(0, cut) : rest).trim();
      const body = cut > 0 ? rest.slice(cut + 1).trim() : '';
      out.push({ label, body });
      return;
    }
    if (out.length) out[out.length - 1].body += (out[out.length - 1].body ? ' ' : '') + line;
  });
  if (out.length < 2) return [{ label: '스타일 요약', body: text.trim() }];
  return out.filter((x) => x.label || x.body);
}

/**
 * 한 줄 요약 — 목록과 칩 아래에 붙는 「어떤 느낌인지」다.
 * 분석 1번 항목이 「한 줄 분위기 요약」이라 그 본문을 그대로 쓴다. 비어 있으면 이름표라도 쓴다.
 */
export function summaryOf(guide, max = 70) {
  const [first] = sectionsOf(guide);
  const line = String(first?.body || first?.label || '').replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/* ============================================================
   항목 골라 쓰기 · 프롬프트 블록
   ============================================================ */

/**
 * 분석 7항목 중 **어느 항목을 어느 호출에 줄지** 정하는 표.
 *
 * ⚠️ 스타일을 통째로 네 군데에 다 넣으면 안 된다. 아웃라인은 구성만 정하고 문체는 안 쓰는데
 *    거기에 어미 규칙까지 넣으면 지시만 길어지고(입력 토큰) 정작 쓰이지 않는다.
 *    반대로 고쳐쓰기에 구성 항목을 주면 다 쓴 글의 소제목을 다시 흔든다.
 *
 * `index` 는 분석 프롬프트(`pages/research.js`)의 항목 번호 - 1 이다. 모델이 번호를 흘리거나
 * 항목을 빠뜨리는 일이 있어 **이름으로 먼저 찾고 번호는 폴백**으로만 쓴다.
 */
const SECTION_SPEC = {
  mood:      { index: 0, keys: ['분위기', '요약'] },
  opening:   { index: 1, keys: ['도입'] },
  rhythm:    { index: 2, keys: ['문장', '리듬', '길이'] },
  structure: { index: 3, keys: ['소제목', '구성'] },
  mix:       { index: 4, keys: ['경험', '비율', '정보'] },
  diction:   { index: 5, keys: ['어휘', '존댓말', '이모지', '강조'] },
  avoid:     { index: 6, keys: ['피해야', '피할'] },
};

/** 이 스킬이 아는 항목 이름들 — 호출부에서 오타를 내면 조용히 빈 블록이 나가므로 던진다. */
export const SECTION_IDS = Object.keys(SECTION_SPEC);

/**
 * 가이드에서 **필요한 항목만** 잘라 낸다.
 *
 * @param {string} guide 저장된 분석 결과 전문
 * @param {string[]} ids `SECTION_SPEC` 의 키들 (원하는 순서대로)
 * @returns {string} 항목들을 붙인 텍스트. 하나도 못 찾으면 빈 문자열.
 */
export function pickSections(guide, ids) {
  const list = sectionsOf(guide);
  // 쪼개기에 실패해 통째로 한 덩어리면 (「스타일 요약」) 나눌 수가 없다 — 그대로 돌려준다.
  if (list.length < 2) return String(guide || '').trim();

  const used = new Set();
  const out = [];
  ids.forEach((id) => {
    const spec = SECTION_SPEC[id];
    if (!spec) throw new Error(`알 수 없는 스타일 항목: ${id}`);
    let hit = list.findIndex((s, i) => !used.has(i) && spec.keys.some((k) => String(s.label).includes(k)));
    if (hit < 0 && !used.has(spec.index)) hit = list[spec.index] ? spec.index : -1;
    if (hit < 0) return;
    used.add(hit);
    const { label, body } = list[hit];
    out.push(body ? `- ${label}: ${body}` : `- ${label}`);
  });
  return out.join('\n');
}

/**
 * 프롬프트에 넣을 스타일 블록.
 *
 * ⚠️ **여기서 승패를 명시하는 게 이 함수의 존재 이유다** (2026-08-21).
 *    예전에는 "참고하는 가이드입니다 / 충돌하면 항상 규칙을 우선하세요" 라고만 적혀 있었다.
 *    그런데 채널 규칙은 같은 항목을 「반드시 지킵니다」로 이미 다 정해 두고 있어서,
 *    스타일이 이길 수 있는 자리가 한 칸도 없었다 — 수집을 해도 결과가 안 바뀐 직접 원인이다.
 *
 *    기준은 하나다. **스타일은 「이렇게 씁니다」를 이기고, 「이건 쓰지 않습니다」는 못 이긴다.**
 *    금지 항목은 사실 관계·법적 표현·그동안 쌓인 품질 바닥선이라 문체 취향으로 풀 것이 아니다.
 *
 * @param {string} guide  저장된 분석 결과
 * @param {string[]} ids  넣을 항목 (`SECTION_SPEC` 키)
 * @param {{title?:string, wins?:string, loses?:string, note?:string}} [opts]
 * @returns {string} 가이드가 없으면 빈 문자열 (호출부에서 `filter(Boolean)` 로 걸러진다)
 */
export function styleBlock(guide, ids, opts = {}) {
  const body = String(guide || '').trim() ? pickSections(guide, ids) : '';
  if (!body) return '';
  const title = opts.title || '■ 블로그 스타일 — 이 글의 문체는 여기가 정합니다';
  return [
    title,
    '',
    '**아래와 다른 말투·리듬·도입 방식이 다른 절에 적혀 있으면 아래를 따릅니다.**',
    opts.wins || '- 스타일이 정합니다: 말투와 어미 · 문장 길이와 줄바꿈 · 도입을 여는 방식 · 어휘와 강조',
    opts.loses || '- 스타일이 바꾸지 못합니다: 상품 자료의 사실과 숫자 · 금지 표현 · 소제목 개수와 순서 · 표식이 정해진 줄',
    '  ⚠️ 다른 절에 **「~하지 않습니다 · 쓰지 마세요 · 실패입니다」로 적힌 것은 그대로 지킵니다.**',
    '     스타일이 바꾸는 것은 **무엇을 할지**이지, 하지 말라고 적힌 것을 되살리는 게 아닙니다.',
    '',
    body,
    '',
    '⚠️ 여기 적힌 제품·주제·산업군·독자·사실·예시는 글에 가져오지 않습니다. **문체만** 가져옵니다.',
    opts.note || '',
    '── 스타일 끝 ──',
  ].filter(Boolean).join('\n');
}
