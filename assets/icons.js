/**
 * 라인 아이콘 (Lucide / Feather 스타일)
 * fill:none / stroke:currentColor / stroke-width:1.5 / 24x24 — .icon 클래스가 담당
 * 장식용 아이콘이므로 aria-hidden="true" 를 기본으로 붙인다.
 */

const PATHS = {
  sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/><path d="M10 12h4"/>',
  fileText: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-4.5-4.5L7 21"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 017.5-2"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M9 21V9"/>',
  check: '<polyline points="4 12.5 9.5 18 20 6.5"/>',
  arrowRight: '<path d="M4 12h15"/><polyline points="13 6 19 12 13 18"/>',
  arrowLeft: '<path d="M20 12H5"/><polyline points="11 18 5 12 11 6"/>',
  download: '<path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 20h16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/>',
  trash: '<path d="M4 7h16"/><path d="M10 4h4a1 1 0 011 1v2H9V5a1 1 0 011-1z"/><path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 6.3"/><polyline points="20 4 20 11 13 11"/>',
  undo: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>',
  redo: '<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 014-4h12"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" stroke="none"/>',
  thread: '<path d="M12 21c5 0 8-3.2 8-8.4C20 6.4 17 3 12 3S4 6.4 4 12.6C4 18 7 21 12 21z"/><path d="M9 13.4c0 1.6 1.3 2.5 2.9 2.5 2.2 0 3.4-1.3 3.4-4.4 0-2.4-1.4-3.7-3.2-3.7-1.3 0-2.3.6-2.8 1.5"/>',
  blog: '<path d="M4 5.5A1.5 1.5 0 015.5 4H10a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4z"/><path d="M20 5.5A1.5 1.5 0 0018.5 4H14a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H20z"/>',
  filter: '<path d="M4 5h16"/><path d="M7 12h10"/><path d="M10 19h4"/>',
  sort: '<path d="M7 4v16"/><polyline points="3 8 7 4 11 8"/><path d="M17 20V4"/><polyline points="13 16 17 20 21 16"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><polyline points="8.5 13.5 7 21 12 18.5 17 21 15.5 13.5"/>',
  tv: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><polyline points="8 3 12 7 16 3"/>',
  shield: '<path d="M12 3l7 3v6c0 4.4-2.9 8.1-7 9-4.1-.9-7-4.6-7-9V6l7-3z"/><polyline points="9 12 11 14 15 10"/>',
  star: '<polygon points="12 3.5 14.6 9 20.5 9.8 16.2 13.9 17.3 19.8 12 17 6.7 19.8 7.8 13.9 3.5 9.8 9.4 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r=".9" fill="currentColor" stroke="none"/>',
  chevronRight: '<polyline points="9 5 16 12 9 19"/>',
  /** 새 탭으로 나가는 링크 표시 — 키 발급 페이지처럼 바깥으로 보내는 자리에 쓴다 */
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 13.5v5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6h5"/>',
};

/**
 * @param {keyof typeof PATHS} name 아이콘 이름
 * @param {string} [cls] 추가 클래스 (예: 'icon--sm')
 * @returns {string} SVG 문자열
 */
export function icon(name, cls = '') {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const iconNames = Object.keys(PATHS);
