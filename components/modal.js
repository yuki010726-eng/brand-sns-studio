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
