/**
 * API 키 입력칸 — 글귀(2단계)와 이미지(3단계)가 함께 쓴다
 *
 * 요청자 결정(2026-08-10): **키는 각자 발급받아 각자 넣는다.**
 * 그래서 이 칸은 숨기지 않는다. 키가 없으면 아무것도 안 되므로 화면에서 가장 잘 보여야 한다.
 *
 * ⚠️ 두 화면이 같은 모양이어야 해서 한 곳에 뒀다. 한쪽만 고치면 같은 일을 하는 칸이
 *    화면마다 다르게 보인다 — 실제로 그랬어서 합쳤다.
 *
 * ⚠️ 키는 제공자별로 **하나**다 (`bboggl.openai-key`). 글귀와 이미지가 같은 키를 쓴다.
 *    그래서 어느 화면에서 넣든 반대쪽에서도 바로 쓸 수 있다.
 */
import { icon } from '../assets/icons.js';

/**
 * 키를 어디서 받는지 — **한 곳에만 둔다.**
 * 발급 주소가 바뀌면 여기만 고치면 두 화면이 함께 바뀐다.
 */
const ISSUE = {
  openai: {
    label: 'OpenAI API KEY',
    url: 'https://platform.openai.com/api-keys',
    linkText: 'OpenAI API 키 발급',
    placeholder: 'sk- 로 시작하는 키를 붙여넣으세요',
    note: 'AI 글쓰기와 이미지 생성을 쓰려면 개인 API 키를 발급해 주세요.',
  },
  gemini: {
    label: 'Gemini API KEY',
    url: 'https://aistudio.google.com/apikey',
    linkText: 'Gemini API 키 발급',
    placeholder: 'AIza 로 시작하는 키를 붙여넣으세요',
    note: 'AI 글쓰기와 이미지 생성을 쓰려면 개인 API 키를 발급해 주세요.',
  },
};

export const issueInfo = (providerId) => ISSUE[providerId] || ISSUE.openai;

/**
 * @param {{providerId:string, inputId:string, hasKey:boolean, masked:string}} ctx
 * @returns {string} HTML
 */
export function keyFieldHTML({ providerId, inputId, hasKey, masked }) {
  const info = issueInfo(providerId);
  return `
    <div class="keyfield">
      <label class="keyfield__label" for="${inputId}">${esc(info.label)}</label>
      <input class="input keyfield__input" type="password" id="${inputId}"
             autocomplete="off" spellcheck="false" placeholder="${esc(info.placeholder)}"
             aria-describedby="${inputId}-hint" />
      ${hasKey ? `<p class="keyfield__saved">${icon('check', 'icon--sm')} 저장됨 · ${esc(masked)}</p>` : ''}

      <div class="keyfield__hint" id="${inputId}-hint">
        <p>${esc(info.note)}</p>
        <a class="keyfield__link" href="${info.url}" target="_blank" rel="noopener noreferrer"
           aria-label="${esc(info.linkText)} 페이지를 새 탭에서 열기">
          ${icon('external', 'icon--sm')} ${esc(info.linkText)}
        </a>
      </div>
    </div>`;
}

const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
