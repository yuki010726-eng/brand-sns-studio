/**
 * 이미지 패널 — 카드 한 장의 배경/아이콘 이미지를 프롬프트로 안내하고, 완성된 파일을 받는다.
 *
 * 원래 3단계(pages/image.js)에 따로 있던 화면인데, 문구와 이미지를 오가며 보는 게
 * 번거로워 템플릿 화면으로 합쳤다. 문구 입력을 마친 뒤 바로 쓸 수 있도록 입력 폼 아래에 놓는다.
 *
 * **이미지는 필수가 아니다.** 없으면 템플릿 기본 배경으로 그려진다.
 * AI 이미지는 이 화면에서 바로 생성하지 않는다(요청자 결정, 2026-08-11) — 프롬프트를
 * 만들어 보여주기만 하고, 실제 이미지는 밖에서 만들어 「파일 올리기」로 넣는다.
 */
import { icon } from '../assets/icons.js';

/**
 * 프롬프트를 들고 갈 곳.
 *
 * 이 자리의 용도가 '키 없이 다른 도구에서 만들기'라, 복사만 시켜 놓고 어디로 갈지
 * 안 알려 주면 흐름이 끊긴다. 그래서 복사 버튼 **바로 옆**에 둔다.
 * 주소가 바뀌면 여기만 고치면 된다.
 */
const TOOLS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
];

/**
 * @param {{index:number, total:number, hasImage:boolean, source:string|null,
 *          prompt:string, label:string, disabled:boolean, lockable?:boolean, locked?:boolean}} ctx
 */
export function imagePanelHTML(ctx) {
  const n = ctx.index + 1;

  if (ctx.disabled) {
    return `
      <section class="imgpanel card" aria-labelledby="imgpanel-head">
        <div class="imgpanel__head">
          <h3 class="imgpanel__title" id="imgpanel-head">${ctx.label}</h3>
        </div>
        <p class="field__hint">이 카드는 단색 배경으로 고정입니다 — 이미지를 쓰지 않습니다.</p>
      </section>`;
  }

  return `
    <section class="imgpanel card" aria-labelledby="imgpanel-head">
      <div class="imgpanel__head">
        <h3 class="imgpanel__title" id="imgpanel-head">${ctx.label}</h3>
        <span class="badge badge--neutral">선택 사항</span>
      </div>

      <p class="field__hint imgpanel__lead">
        ${ctx.hasImage
          ? `${n}번 카드에 ${ctx.source === 'upload' ? '올린' : '생성한'} 이미지가 들어가 있습니다.`
          : '없어도 됩니다. 넣지 않으면 템플릿 기본 배경으로 그려집니다.'}
      </p>

      <details class="imgpanel__prompt" open>
        <summary>이미지 프롬프트</summary>
        <p class="shot__prompt-text">${esc(ctx.prompt)}</p>
        <p class="field__hint">프롬프트를 복사해 원하는 이미지 생성 도구에서 만든 뒤, 「파일 올리기」로 넣으세요.</p>
        <div class="imgpanel__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-img-copy
                  aria-label="${n}번 카드 프롬프트 복사하기">
            ${icon('copy', 'icon--sm')} 프롬프트 복사
          </button>
          <!-- 복사가 주된 동작이라 링크는 가볍게 둔다. 셋이 한 줄에 들어가야 '옆에'로 읽힌다. -->
          ${TOOLS.map((t) => `
            <a class="btn btn--text btn--sm imgpanel__tool" href="${t.url}"
               target="_blank" rel="noopener noreferrer"
               aria-label="${esc(t.name)} 를 새 탭에서 열기">
              ${icon('external', 'icon--sm')} ${esc(t.name)}
            </a>`).join('')}
        </div>
      </details>

      <div class="imgpanel__actions">
        <label class="btn btn--sm imgpanel__upload">
          ${icon('image', 'icon--sm')} 파일 올리기
          <input class="sr-only" type="file" accept="image/*" autocomplete="off"
                 data-img-upload aria-label="${n}번 카드 이미지 파일 선택" />
        </label>
        ${ctx.lockable ? `
          <button type="button" class="btn btn--ghost btn--sm imgpanel__lock${ctx.locked ? ' is-locked' : ''}"
                  data-img-lock aria-pressed="${Boolean(ctx.locked)}"
                  aria-label="${n}번 카드 배경 이미지 ${ctx.locked ? '잠금 해제' : '잠금'}">
            ${icon(ctx.locked ? 'lock' : 'unlock', 'icon--sm')}
            배경 ${ctx.locked ? '잠금됨' : '잠금'}
          </button>` : ''}
        ${ctx.hasImage ? `
          <button type="button" class="btn btn--text btn--sm" data-img-del
                  aria-label="${n}번 카드 이미지 지우기">
            ${icon('trash', 'icon--sm')} 지우기
          </button>` : ''}
      </div>
    </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{onUpload:Function, onDelete:Function, onCopy:Function, onToggleLock?:Function}} h
 */
export function bindImagePanel(root, h) {
  const q = (sel) => root.querySelector(sel);

  q('[data-img-del]')?.addEventListener('click', () => h.onDelete());
  q('[data-img-copy]')?.addEventListener('click', () => h.onCopy());
  q('[data-img-lock]')?.addEventListener('click', () => h.onToggleLock?.());

  q('[data-img-upload]')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) h.onUpload(file);
  });
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
