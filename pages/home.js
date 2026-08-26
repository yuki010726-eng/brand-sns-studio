/**
 * 1단계 — 상품·주제 선택
 * 상품을 고르면 기준 정보 패널이 열리고, 주제를 입력하면 2단계로 넘어간다.
 *
 * Figma jRjBo4LUHkohSoPRqSaEAv, node 8:3 「SNS 게시물 제작」 워크스페이스를 반영했다.
 * ⚠️ 이 다크 워크스페이스 껍데기(`.workshop`)는 **이 페이지 전용**이다. 2·3단계(copy.js·template.js)는
 *    아직 기존 밝은 배경 + 가로 스테퍼(`stepperHTML()`)를 그대로 쓴다 — 이번 반영 범위가 1단계 화면뿐이다.
 */
import { icon } from "../assets/icons.js";
import { PRODUCTS, getProduct } from "../lib/products.js";
import { CHANNELS } from "../data/channels.js";
import { productCardHTML } from "../components/product-card.js";
import { stepperVerticalHTML, bindStepper } from "../components/stepper.js";
import { getState, setState, navigate, newPostId } from "../store.js";
import { toast } from "../components/toast.js";
import { choiceModal, confirmModal } from "../components/modal.js";
import {
  clearLibraryEdit,
  getLibrary,
  getLibraryEditId,
  loadFromLibrary,
  postKeyOf,
} from "../lib/librarystore.js";

export const title = "상품·주제 선택";

/** 톤앤매너 프리셋 — 2단계 카피 생성의 입력값 */
const TONES = [
  { id: "trust", label: "신뢰·정보형", desc: "사실 중심으로 차분하게" },
  { id: "hook", label: "후킹·공감형", desc: "첫 줄에서 시선을 잡고" },
  { id: "plain", label: "담백·실무형", desc: "군더더기 없이 핵심만" },
  { id: "celebrate", label: "축하·발표형", desc: "수상·소식 알림 톤" },
];

export function render(root) {
  const s = getState();

  root.innerHTML = `
    <div class="container">
      <section class="workshop">
        <aside class="workshop__side">
          <p class="workshop__side-title">SNS 게시물 제작</p>
          ${stepperVerticalHTML("/")}
        </aside>

        <div class="workshop__main">
          <div class="workshop__block">
            <div class="workshop__head workshop__head--inline">
              <h1>1. 제작할 게시물의 상품을 선택해 주세요.</h1>
              <p class="workshop__desc">기준 정보는 사내 브랜드 자료(2026-07-23 기준)를 따릅니다.</p>
            </div>
            <div class="prodrow">
              <div class="card prodlist">
                <h2 class="prodlist__title">상품 리스트</h2>
                <div class="prodlist-title-border"></div>
                <fieldset class="prodlist__items" id="product-grid">
                  <legend class="sr-only">광고할 상품을 선택하세요</legend>
                  ${PRODUCTS.map((p) => productCardHTML(p, p.id === s.productId)).join("")}
                </fieldset>
              </div>
              <div class="proddetail" id="detail-panel">${detailHTML()}</div>
            </div>
          </div>

          <div class="workshop__block">
            <h1>2. 게시물의 주제를 선택해주세요.</h1>
            <div id="topic-panel">${topicFormHTML()}</div>
          </div>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindProductGrid(root);
  bindBrief(root);
}

/* ---------------- 상품 상세(다크 패널) ---------------- */

function detailHTML() {
  const s = getState();
  const p = getProduct(s.productId);

  if (!p) {
    return `
      <div class="proddetail__empty">
        ${icon("award", "icon--lg")}
        <p>왼쪽에서 상품을 선택하면 기준 정보가 열립니다.</p>
      </div>`;
  }

  return `
    <div class="proddetail__header">
      <h2 class="prodlist__title">상품 정보</h2>
      <div class="proddetail__icons" aria-hidden="true">
        ${icon("instagram", "icon--proddetail")}
        ${icon("download", "icon--proddetail")}
        ${icon("external", "icon--proddetail")}
      </div>
    </div>
    <div class="proddetail__title-border"></div>
    <div class="proddetail__col">
      <h3 id="brief-title" class="proddetail__name">${p.name}</h3>
      <div class="proddetail__summary-rule">
        <div class="proddetail__summary-accent" aria-hidden="true"></div>
        <p class="brief__summary">${p.summary}</p>
      </div>
      <h3 class="proddetail__name">기본 정보</h3>
      <ul class="brief__list">
        ${p.facts.map((f) => `<li>${icon("check", "icon--sm")}<span>${f}</span></li>`).join("")}
      </ul>
    </div>
    <div class="proddetail__col proddetail__col--benefits">
      ${
        p.events.length
          ? `
      <h3 class="proddetail__name">행사 일정</h3>
      <ul class="brief__list brief__list--events">
        ${p.events
          .map(
            (e) => `
          <li>
            <span class="badge ${e.status === "open" ? "" : "badge--neutral"}">${e.status === "open" ? "진행 예정" : "종료"}</span>
            <span><strong>${e.name}</strong><br /><span class="brief__muted">${e.date} · ${e.desc}</span></span>
          </li>`,
          )
          .join("")}
      </ul>`
          : ""
      }
      ${
        p.criteria.length
          ? `
      <h3 class="proddetail__name">심사 기준</h3>
      <ul class="brief__bars">
        ${p.criteria
          .map(
            (c) => `
          <li>
            <span class="brief__bar-label">${c.label}<b>${c.weight}%</b></span>
            <span class="brief__bar" aria-hidden="true"><span style="width:${c.weight * 2}%"></span></span>
          </li>`,
          )
          .join("")}
      </ul>`
          : ""
      }
      <h3 class="proddetail__name">기본 특전</h3>
      <ul class="brief__tags">${p.benefits.map((b) => `<li>${b}</li>`).join("")}</ul>
      ${
        p.packages.length
          ? `
      <h3 class="proddetail__name">추가 패키지</h3>
      <ul class="brief__list">${p.packages.map((k) => `<li>${icon("plus", "icon--sm")}<span><strong>${k.name}</strong> · ${k.desc}</span></li>`).join("")}</ul>`
          : ""
      }
    </div>`;
}

/* ---------------- 게시물 주제 카드 ---------------- */

function topicFormHTML() {
  const s = getState();
  const p = getProduct(s.productId);
  if (!p) return "";

  const tone = TONES.find((t) => t.id === s.tone) || TONES[0];
  const hasTopic = s.topic.trim().length >= 2;
  const hasOptions = hasTopic && Boolean(s.tone) && Number(s.cardCount) > 0;

  return `
    <div class="card topicform">
      <h2 class="prodlist__title">게시물 주제 설정</h2>
      <div class="prodlist-title-border"></div>
      <div class="topicform__grid">

        <div class="topicform__col" data-topic-step="topic">
          <div class="field">
            <span class="field__label" id="preset-label">추천 주제</span>
            <ul class="chip-row" id="preset-row" aria-labelledby="preset-label">
              ${p.topicPresets
                .map(
                  (t) => `
                <li><button type="button" class="chip" data-preset="${escapeAttr(t)}"
                            aria-label="추천 주제 적용: ${escapeAttr(t)}">${t}</button></li>`,
                )
                .join("")}
              <li>
                <button type="button" class="chip chip--icon" id="shuffle-presets"
                        aria-label="추천 주제 다시 보기">${icon("refresh", "icon--sm")}</button>
              </li>
            </ul>
          </div>

          <div class="field">
            <label class="sr-only" for="topic-input">이번 게시물 주제</label>
            <textarea class="textarea topicform__topic-input" id="topic-input" rows="1" autocomplete="off"
                      placeholder="주제를 입력해주세요. ( 구체적일수록 글귀가 정확해집니다. )"
                      aria-describedby="topic-hint">${escapeHTML(s.topic)}</textarea>
            <p class="field__hint sr-only" id="topic-hint">아래 추천 주제를 눌러 채울 수도 있어요.</p>
          </div>

          <div class="field">
            <label class="field__label" for="focus-input">강조하고 싶은 내용</label>
            <textarea class="textarea topicform__focus-input" id="focus-input" rows="3" autocomplete="off"
                      placeholder="게시물에서 꼭 강조할 내용을 입력해주세요. (선택)"
                      >${escapeHTML(s.focusPoint || "")}</textarea>
          </div>
        </div>

        <span class="topicform__arrow" aria-hidden="true">&gt;</span>

        <div class="topicform__col ${hasTopic ? "" : "is-locked"}" data-topic-step="options" aria-disabled="${!hasTopic}">
          <div class="field">
            <label class="field__label" for="tone-select">글 스타일</label>
            <p class="topicform__style-desc" id="tone-desc">${tone.desc}</p>
            <select class="select" id="tone-select" aria-describedby="tone-desc">
              ${TONES.map((t) => `<option value="${t.id}" ${t.id === s.tone ? "selected" : ""}>${t.label} — ${t.desc}</option>`).join("")}
            </select>
          </div>

          <fieldset class="field">
            <legend class="field__label">이미지 · 카드뉴스 장수</legend>
            <div class="pickrow" role="radiogroup" aria-label="카드뉴스 장수 선택">
              ${[1, 2, 3, 4, 5, 6]
                .map(
                  (n) => `
                <input class="sr-only pick__input" type="radio" name="cardcount" id="cc-${n}" value="${n}"
                       autocomplete="off" aria-label="카드 ${n}장"
                       ${(s.cardCount || 6) === n ? "checked" : ""} />
                <label class="pick" for="cc-${n}">${n}장</label>`,
                )
                .join("")}
            </div>
            <p class="field__hint" id="cc-hint">${cardCountHint(s.cardCount || 6)}</p>
          </fieldset>
        </div>

        <span class="topicform__arrow" aria-hidden="true">&gt;</span>

        <div class="topicform__col ${hasOptions ? "" : "is-locked"}" data-topic-step="channels" aria-disabled="${!hasOptions}">
          <fieldset class="field">
            <legend class="field__label">내보낼 채널</legend>
            <ul class="channel-row">
              ${CHANNELS.map(
                (c) => `
                <li>
                  <input class="sr-only channel__input" type="checkbox" id="ch-${c.id}" value="${c.id}"
                         aria-label="${c.name} — ${c.hint}" autocomplete="off"
                         ${s.channels.includes(c.id) ? "checked" : ""} />
                  <label class="channel" for="ch-${c.id}">
                    ${icon(c.icon, "icon--sm")}
                    <span>
                      <strong>${c.name}</strong>
                      <em>${c.hint}</em>
                    </span>
                  </label>
                </li>`,
              ).join("")}
            </ul>
          </fieldset>
        </div>
      </div>

      <div class="topicform__actions">
        <button type="button" class="btn btn--text" id="clear-topic" aria-label="입력한 주제 지우기">
          초기화
        </button>
        <button type="button" class="btn btn--lg" id="go-copy"
                aria-label="게시물 생성 단계로 이동">
          게시물 생성하기 ${icon("arrowRight", "icon--sm")}
        </button>
      </div>
    </div>`;
}

/* ---------------- 이벤트 바인딩 ---------------- */

function bindProductGrid(root) {
  root.querySelector("#product-grid")?.addEventListener("change", (e) => {
    const input = e.target;
    if (input.name !== "product") return;
    setState({ productId: input.value, libraryTitle: "" });
    refreshDetail(root);
    // 상품을 바꾸면 곧바로 주제 입력으로 초점을 옮겨 흐름이 끊기지 않게 한다
    root.querySelector("#topic-input")?.focus({ preventScroll: true });
  });
}

function refreshDetail(root) {
  const detail = root.querySelector("#detail-panel");
  if (detail) detail.innerHTML = detailHTML();

  const panel = root.querySelector("#topic-panel");
  if (!panel) return;
  panel.innerHTML = topicFormHTML();
  bindBrief(root);
}

function bindBrief(root) {
  const topicEl = root.querySelector("#topic-input");
  const focusEl = root.querySelector("#focus-input");

  topicEl?.addEventListener("input", () => {
    setState({ topic: topicEl.value, libraryTitle: "" });
    syncCta(root);
  });

  focusEl?.addEventListener("input", () => {
    setState({ focusPoint: focusEl.value, libraryTitle: "" });
  });

  root.querySelectorAll('input[name="cardcount"]').forEach((el) => {
    el.addEventListener("change", () => {
      const n = Number(el.value);
      setState({ cardCount: n });
      const hint = root.querySelector("#cc-hint");
      if (hint) hint.textContent = cardCountHint(n);
      syncCta(root);
    });
  });

  root.querySelector("#tone-select")?.addEventListener("change", (e) => {
    setState({ tone: e.target.value });
    const desc = root.querySelector("#tone-desc");
    if (desc)
      desc.textContent = (
        TONES.find((t) => t.id === e.target.value) || TONES[0]
      ).desc;
    syncCta(root);
  });

  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.preset;
      setState({ topic: value, libraryTitle: "" });
      if (topicEl) {
        topicEl.value = value;
        topicEl.focus();
      }
      syncCta(root);
    });
  });

  root.querySelector("#shuffle-presets")?.addEventListener("click", () => {
    const row = root.querySelector("#preset-row");
    if (!row) return;
    const chips = [...row.querySelectorAll("[data-preset]")];
    for (let i = chips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      row.insertBefore(chips[j], chips[i].nextSibling);
      [chips[i], chips[j]] = [chips[j], chips[i]];
    }
  });

  root.querySelectorAll(".channel__input").forEach((box) => {
    box.addEventListener("change", () => {
      const checked = [...root.querySelectorAll(".channel__input")]
        .filter((b) => b.checked)
        .map((b) => b.value);
      if (!checked.length) {
        box.checked = true; // 최소 1개 채널은 유지
        toast("채널은 최소 1개를 선택해야 합니다.");
        return;
      }
      setState({ channels: checked });
    });
  });

  root.querySelector("#clear-topic")?.addEventListener("click", () => {
    setState({ topic: "", focusPoint: "", libraryTitle: "" });
    if (topicEl) {
      topicEl.value = "";
      topicEl.focus();
    }
    if (focusEl) focusEl.value = "";
    syncCta(root);
    toast("주제를 비웠습니다.");
  });

  root.querySelector("#go-copy")?.addEventListener("click", async () => {
    if (!isReady()) {
      toast("상품과 주제를 먼저 입력해 주세요.");
      topicEl?.focus();
      return;
    }
    const s = getState();
    const editingId = getLibraryEditId();
    const editingItem = editingId
      ? getLibrary().find((item) => item.id === editingId)
      : null;
    if (editingItem && editingItem.postKey !== postKeyOf(s)) {
      const makeNew = await confirmModal("새 게시물을 만들까요?", {
        title: "다른 주제를 선택했습니다",
        okLabel: "만들기",
        cancelLabel: "취소",
      });
      if (!makeNew) return;

      // 불러온 게시물의 결과물이 새 주제에 섞이지 않도록 입력 조건만 남기고 제작물을 비운다.
      // ⚠️ `postId` 도 새로 만든다 — 안 그러면 IndexedDB 에 남아 있는 옛 이미지를
      //    4단계가 같은 키로 다시 읽어 온다 (lib/imagestore.js 의 imageKey 주석 참고).
      clearLibraryEdit();
      setState({
        postId: newPostId(),
        drafts: {},
        generated: {},
        variants: {},
        sources: {},
        draftKey: "",
        aiKey: {},
        outline: null,
        researchStyle: null,
        aiRuns: { key: "", list: [] },
        activeAiRun: null,
        image: null,
        images: {},
        card: null,
      });
    }

    const nextState = getState();
    const existing = getLibrary().find(
      (item) => item.postKey === postKeyOf(nextState),
    );
    const isEditingExisting = existing?.id === getLibraryEditId();
    if (existing && !isEditingExisting) {
      const choice = await choiceModal("보관함에 저장되어있는 주제입니다.", {
        title: "보관함에 저장된 주제",
        choices: [{ value: "load", label: "불러오기", primary: true }],
      });
      if (choice !== "load") return;

      const result = await loadFromLibrary(existing.id);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      navigate("/copy");
      return;
    }

    // 홈에서 시작하는 작업은 같은 상품·주제를 다시 골랐더라도 새 작업이다.
    // localStorage에 남은 이전 AI 결과를 그대로 보여 주면 사용자는 생성 버튼을
    // 누르기 전인데도 이미 글이 만들어진 것으로 보인다. 보관함에서 명시적으로
    // 불러와 편집 중인 게시물만 기존 결과를 유지한다.
    if (!isEditingExisting) {
      clearLibraryEdit();
      const current = getState();
      const runsKey = `${current.productId}|${String(current.topic || "").trim()}`;
      const sameTopicRuns =
        current.aiRuns?.key === runsKey ||
        TONES.some(({ id }) => current.aiRuns?.key === `${runsKey}|${id}`);
      setState({
        // 주제가 바뀌면 이미지도 새 게시물 것이다 (imageKey 주석 참고)
        postId: newPostId(),
        drafts: {},
        generated: {},
        variants: {},
        sources: {},
        draftKey: "",
        aiKey: {},
        outline: null,
        researchStyle: null,
        aiRuns: sameTopicRuns ? current.aiRuns : { key: "", list: [] },
        activeAiRun: null,
        image: null,
        images: {},
        card: null,
      });
    }
    navigate("/copy");
  });

  syncCta(root);
}

/**
 * 장수를 줄여도 글은 기승전결을 그대로 쓴다. 줄어드는 것은 이미지뿐이다.
 * 그래서 안내도 '무엇이 빠지는지'가 아니라 '카드가 무엇을 담는지'로 적는다.
 */
function cardCountHint(n) {
  const plan =
    {
      1: "표지 한 장에 후킹과 마무리를 함께 얹습니다.",
      2: "표지 · 마무리",
      3: "표지 · 본문 1 · 마무리",
      4: "표지 · 본문 2 · 마무리",
      5: "표지 · 본문 2 · 반론 · 마무리",
      6: "표지 · 본문 3 · 반론 · 마무리",
    }[n] || "";
  return `${plan} 장수를 줄여도 블로그·인스타 글은 기승전결을 그대로 씁니다. 이미지만 줄어듭니다.`;
}

function isReady() {
  const s = getState();
  return Boolean(s.productId) && s.topic.trim().length >= 2;
}

function syncCta(root) {
  const s = getState();
  const hasTopic = s.topic.trim().length >= 2;
  const hasOptions = hasTopic && Boolean(s.tone) && Number(s.cardCount) > 0;
  setStepState(root.querySelector('[data-topic-step="options"]'), hasTopic);
  setStepState(root.querySelector('[data-topic-step="channels"]'), hasOptions);
  const btn = root.querySelector("#go-copy");
  if (btn) btn.disabled = !isReady();
}

function setStepState(step, enabled) {
  if (!step) return;
  step.classList.toggle("is-locked", !enabled);
  step.setAttribute("aria-disabled", String(!enabled));
  step.querySelectorAll("input, select, button, textarea").forEach((control) => {
    control.disabled = !enabled;
  });
}

/* ---------------- 유틸 ---------------- */

const escapeHTML = (str = "") =>
  str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const escapeAttr = (str = "") => escapeHTML(str);
