/** 짧은 안내를 표시하는 접근성 대응 확인 모달. */
export function modal(message) {
  document.querySelector('.message-modal')?.remove();

  const el = document.createElement('div');
  el.className = 'message-modal';
  el.innerHTML = `
    <div class="message-modal__backdrop"></div>
    <section class="message-modal__dialog" role="alertdialog" aria-modal="true" aria-labelledby="message-modal-title" aria-describedby="message-modal-desc">
      <h2 id="message-modal-title">안내</h2>
      <p id="message-modal-desc"></p>
      <button class="btn message-modal__button" type="button">확인</button>
    </section>`;
  el.querySelector('#message-modal-desc').textContent = message;
  document.body.appendChild(el);

  const close = () => el.remove();
  el.querySelector('.message-modal__button').addEventListener('click', close);
  el.querySelector('.message-modal__backdrop').addEventListener('click', close);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  el.querySelector('.message-modal__button').focus();
}

/**
 * 되돌릴 수 없는 동작 앞에 세우는 확인 모달.
 *
 * `confirm()` 을 쓰지 않는 이유: 브라우저 기본 대화상자는 문구를 우리 말투로 못 쓰고
 * 버튼 이름도 못 바꾼다. 「삭제」·「덮어쓰기」처럼 결과가 다른 동작에는 이름이 중요하다.
 *
 * @param {string} message 무슨 일이 일어나는지
 * @param {{ okLabel?: string, cancelLabel?: string, title?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>} 확인을 눌렀으면 true
 */
export function confirmModal(message, options = {}) {
  const { okLabel = '확인', cancelLabel = '취소', title = '확인', danger = false } = options;
  document.querySelector('.message-modal')?.remove();

  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'message-modal';
    el.innerHTML = `
      <div class="message-modal__backdrop"></div>
      <section class="message-modal__dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-desc">
        <h2 id="confirm-modal-title"></h2>
        <p id="confirm-modal-desc"></p>
        <div class="message-modal__actions">
          <button class="btn btn--ghost" type="button" data-confirm="no"></button>
          <button class="btn${danger ? ' btn--danger' : ''}" type="button" data-confirm="yes"></button>
        </div>
      </section>`;
    el.querySelector('#confirm-modal-title').textContent = title;
    el.querySelector('#confirm-modal-desc').textContent = message;
    const no = el.querySelector('[data-confirm="no"]');
    const yes = el.querySelector('[data-confirm="yes"]');
    no.textContent = cancelLabel;
    no.setAttribute('aria-label', cancelLabel);
    yes.textContent = okLabel;
    yes.setAttribute('aria-label', okLabel);

    // 되돌아온 뒤 원래 있던 곳으로 포커스를 돌려준다
    const opener = document.activeElement;
    const close = (answer) => {
      el.remove();
      if (opener?.isConnected) opener.focus();
      resolve(answer);
    };

    yes.addEventListener('click', () => close(true));
    no.addEventListener('click', () => close(false));
    el.querySelector('.message-modal__backdrop').addEventListener('click', () => close(false));
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { close(false); return; }
      // 모달 밖으로 탭이 빠져나가지 않게 두 버튼 사이에 가둔다
      if (event.key !== 'Tab') return;
      const focusables = [no, yes];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    document.body.appendChild(el);
    yes.focus();
  });
}
