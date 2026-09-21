// 페이지 자체 세계(MAIN)에서 도는 작은 갈고리. 확장 프로그램 세계의 채우기 스크립트(filler.js)와는
// window.postMessage 로만 대화한다.
//  1) 사진 추가 버튼이 여는 OS 파일 선택창을 가로채, 미리 받아 둔 이미지 파일을 대신 넣는다.
//  2) 채우는 동안만 confirm/alert 를 자동 확인해 대화상자가 작업을 멈추지 않게 한다.
(() => {
  if (window.__bssHook) return;
  window.__bssHook = true;

  let armed = null;

  const feed = (input) => {
    if (!armed) return false;
    const { name, mime, buffer } = armed;
    armed = null;
    const transfer = new DataTransfer();
    transfer.items.add(new File([buffer], name, { type: mime }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    window.postMessage({ __bss: "file-set" }, "*");
    return true;
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.__bss !== "arm-file") return;
    armed = { name: event.data.name, mime: event.data.mime, buffer: event.data.buffer };
  });

  const originalClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function patchedClick(...args) {
    if (armed && this.type === "file" && feed(this)) return;
    return originalClick.apply(this, args);
  };

  window.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (armed && target instanceof HTMLInputElement && target.type === "file") {
        event.preventDefault();
        event.stopImmediatePropagation();
        feed(target);
      }
    },
    true,
  );

  const filling = () => document.documentElement.getAttribute("data-bss-filling") === "1";
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  window.confirm = (...args) => (filling() ? true : originalConfirm.apply(window, args));
  window.alert = (...args) => (filling() ? undefined : originalAlert.apply(window, args));
})();
