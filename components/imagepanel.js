/**
 * 이미지 패널 — 카드 한 장의 배경/아이콘 이미지를 만들거나 올린다.
 *
 * 원래 3단계(pages/image.js)에 따로 있던 화면인데, 문구와 이미지를 오가며 보는 게
 * 번거로워 템플릿 화면으로 합쳤다. 문구 입력칸 반대쪽(미리보기 아래)에 놓는다.
 *
 * **이미지는 필수가 아니다.** 없으면 템플릿 기본 배경으로 그려진다.
 * 그래서 이 패널은 '열어보고 원하면 쓰는' 자리로 만든다 — 흐름을 막지 않는다.
 */
import { icon } from '../assets/icons.js';
import {
  hasKey, maskedKey, setKey, getModel, setModel, MODELS,
  PROVIDERS, getProvider, setProvider, currentProvider, keyStatus,
} from '../lib/imagegen.js';

/**
 * @param {{index:number, total:number, hasImage:boolean, source:string|null,
 *          prompt:string, label:string, disabled:boolean, busy:boolean}} ctx
 */
export function imagePanelHTML(ctx) {
  const on = hasKey();
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

      <div class="imgpanel__actions">
        <button type="button" class="btn btn--sm" data-img-gen
                aria-label="${n}번 카드 이미지 AI로 생성하기" ${on ? '' : 'disabled'}>
          ${icon('sparkles', 'icon--sm')} AI로 생성
        </button>
        <label class="btn btn--ghost btn--sm imgpanel__upload">
          ${icon('image', 'icon--sm')} 파일 올리기
          <input class="sr-only" type="file" accept="image/*" autocomplete="off"
                 data-img-upload aria-label="${n}번 카드 이미지 파일 선택" />
        </label>
        ${ctx.hasImage ? `
          <button type="button" class="btn btn--text btn--sm" data-img-del
                  aria-label="${n}번 카드 이미지 지우기">
            ${icon('trash', 'icon--sm')} 지우기
          </button>` : ''}
      </div>

      <div class="imgpanel__busy" data-img-busy ${ctx.busy ? '' : 'hidden'}>
        <span class="spinner" aria-hidden="true"></span>
        <span>만드는 중…</span>
      </div>

      <details class="imgpanel__prompt">
        <summary>이미지 프롬프트 보기</summary>
        <p class="shot__prompt-text">${esc(ctx.prompt)}</p>
        <div class="imgpanel__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-img-copy
                  aria-label="${n}번 카드 프롬프트 복사하기">
            ${icon('copy', 'icon--sm')} 프롬프트 복사
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-img-copyall
                  aria-label="카드 ${ctx.total}장 프롬프트 전체 복사하기">
            ${icon('copy', 'icon--sm')} 전체 복사
          </button>
        </div>
        <p class="field__hint">키 없이 쓰려면 프롬프트를 복사해 다른 도구에서 만든 뒤 「파일 올리기」로 넣으세요.</p>
      </details>

      <div class="imgpanel__keybar">
        <span class="keybar__state ${on ? 'is-on' : ''}">
          ${icon(on ? 'check' : 'alert', 'icon--sm')}
          ${on ? `${esc(currentProvider().name)} 연결됨 · ${esc(maskedKey())}` : `${esc(currentProvider().name)} 키 없음`}
        </span>
        <button type="button" class="btn btn--ghost btn--sm" data-img-keytoggle
                aria-expanded="false" aria-controls="imgpanel-key"
                aria-label="이미지 생성 설정 열기">
          ${on ? '설정 변경' : '자동 생성 켜기'}
        </button>
      </div>

      <div class="imgpanel__key" id="imgpanel-key" hidden>
        <div class="notice notice--warn" role="note">
          <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
          <div>
            <strong>이 키는 브라우저에만 저장됩니다</strong>
            <ul>
              <li>코드나 저장소에는 남지 않고, 이 컴퓨터의 브라우저에만 보관됩니다.</li>
              <li>브라우저에서 직접 호출하는 방식이라 <b>외부에 배포하면 키가 노출됩니다.</b> 개인·내부용으로만 쓰세요.</li>
            </ul>
          </div>
        </div>

        <div class="field">
          <label class="field__label" for="imgpanel-provider">어디로 만들까요</label>
          <select class="select" id="imgpanel-provider">
            ${PROVIDERS.map((p) => `<option value="${p.id}" ${p.id === getProvider() ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
          <p class="field__hint">${esc(currentProvider().note)}</p>
          <p class="field__hint">${keyStatus().map((k) => `${esc(k.name)} ${k.ready ? '✅' : '—'}`).join(' · ')}
             <span class="sr-only">키가 저장된 제공자 표시</span></p>
        </div>

        <div class="field">
          <label class="field__label" for="imgpanel-key-input">${esc(currentProvider().name)} API 키</label>
          <input class="input" type="password" id="imgpanel-key-input"
                 autocomplete="off" spellcheck="false" />
          <p class="field__hint">${esc(currentProvider().keyHint)}</p>
        </div>

        <div class="field">
          <label class="field__label" for="imgpanel-model">모델</label>
          <select class="select" id="imgpanel-model">
            ${MODELS().map((m) => `<option value="${m.id}" ${m.id === getModel() ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
          </select>
          <p class="field__hint">${esc(MODELS().find((m) => m.id === getModel())?.note || '')}</p>
        </div>

        <div class="imgpanel__actions">
          <button type="button" class="btn btn--sm" data-img-keysave aria-label="API 키 저장하기">저장</button>
          ${on ? '<button type="button" class="btn btn--text btn--sm" data-img-keyclear aria-label="저장된 API 키 삭제하기">키 삭제</button>' : ''}
        </div>
      </div>

      <button type="button" class="btn btn--soft btn--sm imgpanel__all" data-img-genall
              aria-label="카드 ${ctx.total}장 이미지 모두 생성하기" ${on ? '' : 'disabled'}>
        ${icon('sparkles', 'icon--sm')} ${ctx.total}장 모두 생성
      </button>
    </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{onGenerate:Function, onGenerateAll:Function, onUpload:Function,
 *          onDelete:Function, onCopy:Function, onCopyAll:Function, onKeyChange:Function}} h
 */
export function bindImagePanel(root, h) {
  const q = (sel) => root.querySelector(sel);

  q('[data-img-gen]')?.addEventListener('click', () => h.onGenerate());
  q('[data-img-genall]')?.addEventListener('click', () => h.onGenerateAll());
  q('[data-img-del]')?.addEventListener('click', () => h.onDelete());
  q('[data-img-copy]')?.addEventListener('click', () => h.onCopy());
  q('[data-img-copyall]')?.addEventListener('click', () => h.onCopyAll());

  q('[data-img-upload]')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) h.onUpload(file);
  });

  const form = q('#imgpanel-key');
  const toggle = q('[data-img-keytoggle]');
  toggle?.addEventListener('click', () => {
    const open = form.hidden;
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) q('#imgpanel-key-input')?.focus();
  });

  q('[data-img-keysave]')?.addEventListener('click', () => {
    const input = q('#imgpanel-key-input');
    const value = input.value.trim();
    if (!value) { h.onKeyChange(null, '키를 입력해 주세요.'); input.focus(); return; }
    setKey(value);
    setModel(q('#imgpanel-model').value);
    input.value = '';                       // 화면에 남기지 않는다
    h.onKeyChange(true, '키를 저장했습니다. 이제 생성 버튼을 쓸 수 있습니다.');
  });

  q('[data-img-keyclear]')?.addEventListener('click', () => {
    setKey('');
    h.onKeyChange(false, '저장된 키를 삭제했습니다.');
  });

  q('#imgpanel-model')?.addEventListener('change', (e) => setModel(e.target.value));

  // 제공자를 바꾸면 키·모델 목록이 통째로 달라져 패널을 다시 그려야 한다
  q('#imgpanel-provider')?.addEventListener('change', (e) => {
    setProvider(e.target.value);
    h.onKeyChange(hasKey(), `${currentProvider().name} 로 바꿨습니다.`);
  });
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
