// 앱 화면(같은 origin) ↔ 확장 프로그램 백그라운드를 잇는 다리. 앱은 window.postMessage 로만 말한다.
const ORIGIN = location.origin;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== ORIGIN) return;
  const data = event.data;
  if (!data || data.source !== "bss-app") return;

  const reply = (extra) => window.postMessage({ source: "bss-ext", id: data.id, ...extra }, ORIGIN);

  if (data.type === "ping") {
    reply({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }

  if (data.type === "naver-fill") {
    chrome.runtime
      .sendMessage({ type: "start-fill", blogId: data.blogId, job: data.job })
      .then(
        (result) => reply(result || { ok: false, error: "확장 프로그램이 응답하지 않았습니다." }),
        (error) =>
          reply({
            ok: false,
            error: `확장 프로그램과 통신하지 못했습니다. 확장 프로그램을 새로 고침한 뒤 이 페이지도 새로고침해 주세요. (${error?.message || error})`,
          }),
      );
  }
});
