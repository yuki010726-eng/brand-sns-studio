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
