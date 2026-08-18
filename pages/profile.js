/**
 * 프로필 탭 — 인스타그램 계정 프로필 세팅
 *
 * 흐름은 요청자가 정한 순서 그대로다.
 *   ① 브랜드 어워즈 / AI TV CF / 마케터 선택
 *   ② 그 유형에 맞게 이름·프로필 이미지·소개를 무작위 제작
 *   ③ litt.ly 링크 추가
 *
 * 이미지 생성 API 연결은 다음 작업이다(요청자 지시). 지금은 **영문 프롬프트까지** 만들어 둔다.
 *
 * ────────────────────────────────────────────────
 * ⚠️ **`render()` 의 템플릿 리터럴 안에 백틱(`)을 절대 넣지 말 것.**
 *
 *    화면 전체가 하나의 템플릿 리터럴이다. 그 안에 설명을 적겠다고 HTML 주석을 넣고
 *    거기에 백틱을 쓰면 **템플릿이 그 자리에서 끊긴다.** 뒤에 오던 HTML 이 JS 코드로
 *    해석돼 `label is not defined` 로 죽고, **프로필 화면이 통째로 빈 화면이 된다.**
 *    실제로 2026-08-13 에 그렇게 났다 — 주석에 적은 `<label>` 한 단어 때문이었다.
 *    구조 설명은 이렇게 **템플릿 바깥(파일 머리말이나 함수 위)** 에 적는다.
 *
 * 유형 선택 구조 (2026-08-13, 요청자 지시)
 * - `.channel-row--cols` 로 **가로 3칸**. 세로로 쌓으니 칸이 너무 길다는 지적이었다.
 *   720px 이하에서는 CSS 가 세로로 되돌린다 — 3칸을 375px 에 넣으면 글자가 깨진다.
 * - 브랜드 선택(`#brand-slot`)은 **어워즈 카드 안**에 둔다. 단 `<label>` **바깥**이어야 한다.
 *   라벨 안에 넣으면 칩을 누를 때 라벨이 클릭을 먼저 먹어서 유형 라디오가 다시 선택되고
 *   칩이 안 눌린다.
 */
import { icon } from '../assets/icons.js';
import { getState, setState, navigate } from '../store.js';
import { toast } from '../components/toast.js';
import {
  PROFILE_TYPES, AWARD_BRANDS, MARKETER_STYLES, LIMITS, LITTLY_SIGNUP,
  buildProfile, littlySlug, littlyUrl, replaceLinkLine, needsPhoto,
} from '../lib/profile.js';
import { putImage, getImage, deleteImage, objectUrl } from '../lib/imagestore.js';

export const title = '프로필 세팅';

/**
 * 미리보기 아바타에 쓸 이미지.
 *
 * ⚠️ **state 에 넣지 않는다.** 이미지 Blob 은 localStorage 에 안 들어가고(8-1 과 같은 이유),
 *    `SYNCED_KEYS` 를 타면 실제 Blob 이 없는 기기에서 있다고 표시된다(11절 경고 그대로).
 *    Blob 은 IndexedDB 에 두고 화면은 objectURL 만 들고 있는다.
 * ⚠️ 계정은 하나뿐이라 키도 하나다. 카드 이미지(`imageKey`)와 섞이지 않게 이름을 따로 둔다.
 */
const AVATAR_KEY = 'profile-avatar';
let avatarUrl = null;

export function render(root) {
  const s = getState();
  const profile = s.profile;

  root.innerHTML = `
    <div class="container">
      <section class="hero">
        <div class="hero__title-row">
          <h1>계정 프로필을 설정해 보세요</h1>
          <span class="hero__info">
            <button class="hero__info-button" type="button"
                    aria-label="계정 프로필 설정 안내" aria-describedby="profile-hero-help">i</button>
            <span class="hero__sub" id="profile-hero-help" role="tooltip">
              유형을 고르면 이름·소개·프로필 이미지 초안을 만들어 드립니다.
              마음에 들지 않을 경우 하단 「다시 뽑기」를 누르시면 됩니다.
            </span>
          </span>
        </div>
      </section>

      <section class="section" aria-labelledby="sec-type">
        <div class="section__head">
          <h2 id="sec-type">1. 계정 유형</h2>
        </div>

        <ul class="channel-row channel-row--cols">
          ${PROFILE_TYPES.map((t) => `
            <li class="channel-cell${t.id === 'awards' || t.id === 'marketer' ? ' channel-cell--group' : ''}">
              <input class="sr-only channel__input" type="radio" name="ptype" id="ptype-${t.id}"
                     value="${t.id}" autocomplete="off"
                     aria-label="${escAttr(t.label)} — ${escAttr(t.desc)}"
                     ${profile?.typeId === t.id ? 'checked' : ''} />
              <label class="channel" for="ptype-${t.id}">
                ${icon('sparkles', 'icon--sm')}
                <span>
                  <strong>${esc(t.label)}</strong>
                  <em>${esc(t.desc)}</em>
                </span>
              </label>
              ${t.id === 'awards' ? `<div id="brand-slot">${brandHTML(profile)}</div>` : ''}
              ${t.id === 'marketer' ? `<div id="marketer-style-slot">${marketerStyleHTML(profile)}</div>` : ''}
            </li>`).join('')}
        </ul>
      </section>

      <section class="section" aria-labelledby="sec-draft">
        <div class="section__head">
          <h2 id="sec-draft">2. 이름 · 소개 · 프로필 이미지</h2>
        </div>
        <div class="profile-editor">
          <div class="profile-stage">
            <div id="p-preview">${previewHTML(profile)}</div>
            <p class="profile-stage__note">
              인스타그램 프로필에서 보이는 모양을 흉내 낸 미리보기입니다. 실제 화면과는 다를 수 있어요.
            </p>
          </div>
          <div id="draft-slot">${draftHTML(profile)}</div>
        </div>
      </section>

      <div class="flow-actions">
        <button type="button" class="btn btn--lg" id="go-home"
                aria-label="상품·주제 선택 단계로 이동">
          상품·주제 선택하기 ${icon('arrowRight', 'icon--sm')}
        </button>
      </div>
    </div>`;

  bindType(root);
  bindDraft(root);

  root.querySelector('#go-home')?.addEventListener('click', () => navigate('/'));

  /**
   * 저장해 둔 아바타를 뒤늦게 얹는다. IndexedDB 는 비동기라 첫 렌더를 기다리게 하지 않는다 —
   * 기다리면 이미지 하나 때문에 화면 전체가 늦게 뜬다.
   */
  if (!avatarUrl) {
    getImage(AVATAR_KEY).then((blob) => {
      if (!blob || !root.querySelector('#p-preview')) return;
      avatarUrl = objectUrl(blob);
      refreshPreview(root);
      refreshPhotoRow(root);
    }).catch(() => { /* 저장소가 막힌 환경이면 아바타 없이 간다 */ });
  }
}

/* ---------------- 브랜드 선택 (어워즈형 전용) ---------------- */

/**
 * 어워즈형은 어느 브랜드 계정인지에 따라 이름·사실·litt.ly 주소가 전부 달라진다.
 * 승인된 상품 4종에서 가져오므로 여기서 행사명을 지어내지 않는다.
 *
 * ⚠️ `<fieldset>` 을 쓰지 않는다. 브라우저 기본 테두리(2px groove)가 그대로 살아
 *    검은 네모 상자로 보였다 — 요청자 지적(2026-08-11).
 *    `.field` 에는 테두리 해제가 없고, `.brief__form fieldset` 규칙은 2단계 전용이라
 *    여기까지 오지 않는다. 라디오 묶음의 접근성은 `role="radiogroup"` + `aria-labelledby` 로 유지한다.
 *
 * ⚠️ **litt.ly 주소를 여기에 다시 붙이지 말 것** (요청자 지적 2026-08-11).
 *    브랜드를 고르는 자리에 주소가 왜 나오는지 읽는 사람이 알 수 없다.
 *    주소는 아래 링크 칸에서만 다룬다. 칩의 `title`·`aria-label` 에도 넣지 않는다.
 *
 * ⚠️ **「어느 브랜드인가요?」 라벨을 다시 넣지 말 것** (요청자 지시 2026-08-14).
 *    칩이 어워즈 칸 **안에** 들어가 있으므로 무엇을 고르는 자리인지는 칸이 이미 말해 준다.
 *    라벨을 넣으면 한 칸 안에 제목이 둘이 되고 칸만 길어진다.
 *    ⚠️ 라벨을 없앤다고 `role="radiogroup"` 까지 없애면 안 된다 — 스크린리더에는 묶음 이름이
 *       있어야 한다. 화면에 안 보이는 `aria-label` 로 남긴다.
 */
function brandHTML(profile) {
  if (profile?.typeId !== 'awards') return '';
  return `
    <div class="brandpick">
      <!-- 한 줄짜리 칩으로 둔다. 예전에는 4개가 큰 카드로 세로로 쌓여 화면을 다 먹었다. -->
      <div class="pickrow" role="radiogroup" aria-label="어느 브랜드인가요?">
        ${AWARD_BRANDS.map((b) => `
          <input class="sr-only pick__input" type="radio" name="pbrand" id="pbrand-${b.id}"
                 value="${b.id}" autocomplete="off" aria-label="${escAttr(b.label)}"
                 ${profile.brandId === b.id ? 'checked' : ''} />
          <label class="pick" for="pbrand-${b.id}">${esc(b.short)}</label>
        `).join('')}
      </div>
    </div>`;
}

/**
 * 마케터형 아바타 방식 선택 (심볼/인물) — 브랜드 칩과 같은 자리, 같은 패턴이다.
 * 어워즈의 `brandHTML()` 을 그대로 본떴다 — 칩을 라디오 `<label>` 밖에 두는 이유,
 * 라벨을 생략하고 `aria-label` 로만 이름을 남기는 이유가 전부 같다(위 `brandHTML` 주석 참고).
 */
function marketerStyleHTML(profile) {
  if (profile?.typeId !== 'marketer') return '';
  const current = profile.marketerStyle || 'symbol';
  return `
    <div class="brandpick">
      <div class="pickrow" role="radiogroup" aria-label="아바타를 심볼로 만들까요, 인물로 만들까요?">
        ${MARKETER_STYLES.map((m) => `
          <input class="sr-only pick__input" type="radio" name="pmstyle" id="pmstyle-${m.id}"
                 value="${m.id}" autocomplete="off" aria-label="${escAttr(m.label)} — ${escAttr(m.desc)}"
                 ${current === m.id ? 'checked' : ''} />
          <label class="pick" for="pmstyle-${m.id}">${esc(m.label)}</label>
        `).join('')}
      </div>
    </div>`;
}

/* ---------------- 인스타 프로필 미리보기 ---------------- */

/**
 * 왼쪽에 붙는 인스타그램 느낌의 프로필 미리보기 (요청자 지시 2026-08-14 —
 * "이름·소개·프로필, 좌측에 미리 보기 세팅. 계정 세팅 시 시각적으로 보여줌").
 *
 * 입력칸만 보고서는 30자·150자가 실제로 어떻게 보이는지 알 수 없다. 특히 소개는
 * `。` 로 여백을 만드는 구조라(8-5) 줄바꿈이 살아 있는 화면에서 봐야 판단이 된다.
 *
 * ⚠️ **게시물·팔로워 수를 지어내지 않는다.** 아직 없는 계정이라 숫자를 채우면 거짓이 된다.
 *    자리는 인스타 모양대로 두되 값은 `—` 로 비워 둔다.
 * ⚠️ **소개는 `white-space: pre-line` 으로 그린다.** 줄바꿈이 이 화면의 존재 이유다.
 * ⚠️ 이 함수는 `render()` 의 템플릿 리터럴 안에서 불린다. 파일 머리말 경고대로
 *    여기에 HTML 주석과 백틱을 넣지 말 것.
 */
function previewHTML(profile) {
  if (!profile) {
    return `
      <div class="igp igp--empty">
        <p>유형을 고르면 여기에 프로필 미리보기가 나타납니다.</p>
      </div>`;
  }

  const initial = (profile.name || '?').trim().charAt(0) || '?';
  const handle = profile.slug || 'account';
  const shownLink = String(profile.link || '').replace(/^https?:\/\//, '');

  /**
   * 올린 사진이 있으면 그것을 아바타 자리에 그대로 넣는다 (요청자 지시 2026-08-14 —
   * "사진 업로드해서 프로필 이미지가 이런 느낌으로 나온다고 보여주도록").
   * 없으면 이름 첫 글자를 쓴다.
   */
  const avatar = avatarUrl
    ? `<img class="igp__avatar igp__avatar--photo" src="${escAttr(avatarUrl)}" alt="올린 프로필 이미지 미리보기" />`
    : `<span class="igp__avatar" aria-hidden="true">${esc(initial)}</span>`;

  return `
    <div class="igp">
      <div class="igp__bar">
        <span class="igp__handle">${esc(handle)}</span>
      </div>
      <div class="igp__top">
        ${avatar}
        <ul class="igp__stats">
          ${[['게시물', '—'], ['팔로워', '—'], ['팔로우', '—']].map(([label, value]) => `
            <li><strong>${value}</strong><span>${label}</span></li>`).join('')}
        </ul>
      </div>
      <p class="igp__name">${esc(profile.name)}</p>
      <p class="igp__bio">${esc(profile.bio)}</p>
      ${shownLink ? `<p class="igp__link">${esc(shownLink)}</p>` : ''}
      <div class="igp__actions" aria-hidden="true">
        <span class="igp__btn">팔로우</span>
        <span class="igp__btn igp__btn--soft">메시지</span>
      </div>
      <div class="igp__grid" aria-hidden="true">
        ${Array.from({ length: 6 }, () => '<span></span>').join('')}
      </div>
    </div>`;
}

/** 미리보기만 다시 그린다 — 입력칸을 건드리면 캐럿이 튄다 */
function refreshPreview(root) {
  const slot = root.querySelector('#p-preview');
  if (slot) slot.innerHTML = previewHTML(getState().profile);
}

/* ---------------- 초안 ---------------- */

function draftHTML(profile) {
  if (!profile) {
    return `
      <div class="notice notice--info" role="note">
        <span class="notice__icon" aria-hidden="true">${icon('sparkles', 'icon--sm')}</span>
        <div>
          <strong>위에서 유형을 먼저 고르세요</strong>
          <p>고르는 즉시 이름·소개·이미지 프롬프트 초안이 만들어집니다.</p>
        </div>
      </div>`;
  }

  return `
    <div class="card profile-draft">
      <div class="field">
        <label class="field__label" for="p-name">계정 이름</label>
        <input class="input" id="p-name" value="${escAttr(profile.name)}"
               maxlength="${LIMITS.name}" autocomplete="off" spellcheck="false" />
        <p class="field__hint">${profile.name.length} / ${LIMITS.name}자</p>
      </div>

      <div class="field">
        <label class="field__label" for="p-bio">소개</label>
        <textarea class="textarea" id="p-bio" rows="7"
                  maxlength="${LIMITS.bio}" autocomplete="off" spellcheck="false">${esc(profile.bio)}</textarea>
        <p class="field__hint">${profile.bio.length} / ${LIMITS.bio}자 ·
           「。」은 인스타가 빈 줄을 먹어버려서 여백 대신 넣는 글자입니다. 레퍼런스도 같은 방식입니다.</p>
      </div>

      <!--
        ⚠️ 라벨과 전체 주소 표시를 화면에서 뺐다 (요청자 지적 2026-08-11).
           입력칸 앞에 litt.ly/ 접두사가 이미 붙어 있어서, 라벨도 그 아래 주소 한 줄도
           같은 말을 세 번 하는 셈이었다.

           라벨은 지우지 않고 sr-only 로만 돌렸다 — 지우면 입력칸에 이름이 없어져
           스크린리더가 무슨 칸인지 읽지 못한다. 접근성 규칙이 디자인보다 우선이다.
           만들기 링크는 요청자 지시로 남긴다.

           ⚠️ 이 주석은 템플릿 리터럴 안에 있다. 백틱을 쓰면 문자열이 거기서 끊긴다.
      -->
      <div class="field">
        <label class="sr-only" for="p-slug">litt.ly 링크 주소</label>
        <div class="inline-field">
          <span class="inline-field__prefix">litt.ly/</span>
          <input class="input" id="p-slug" value="${escAttr(profile.slug)}"
                 autocomplete="off" spellcheck="false" />
        </div>
        <p class="field__hint">
          litt.ly 계정이 없다면 —
          <a href="${LITTLY_SIGNUP}" target="_blank" rel="noopener noreferrer">litt.ly 만들기</a>
        </p>
      </div>

      ${imageHTML(profile)}

      <div class="keybar__actions">
        <button type="button" class="btn btn--soft btn--sm" id="p-regen"
                aria-label="프로필 초안 다시 뽑기">
          ${icon('refresh', 'icon--sm')} 다시 뽑기
        </button>
        <button type="button" class="btn btn--sm" id="p-copy"
                aria-label="프로필 전체를 복사하기">
          ${icon('copy', 'icon--sm')} 전체 복사
        </button>
        <button type="button" class="btn btn--text btn--sm" id="p-copy-img"
                aria-label="이미지 프롬프트만 복사하기">프롬프트만 복사</button>
      </div>
    </div>

    <div class="notice notice--warn" role="note">
      <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
      <div>
        <strong>올리기 전에 반드시 확인하세요</strong>
        <p>여기서 만든 이름·연도·행사명은 <b>무작위 조합한 초안</b>입니다.
           실제 계정에 올릴 때는 공식 자료와 맞는지 직접 확인해 주세요.</p>
      </div>
    </div>`;
}

/* ---------------- 프로필 이미지 프롬프트 ---------------- */

/**
 * 프로필 이미지 프롬프트.
 *
 * ⚠️ **로고 첨부 UI 는 뺐다** (요청자 지시 2026-08-11). 로고 미리보기·내려받기 버튼·
 *    「로고 첨부해서 만들기」 토글이 모두 있었는데, 정작 로고 파일이 하나도 없어서
 *    「로고 준비 중」과 비활성 버튼만 자리를 차지했다. 파일이 준비되면 다시 붙인다.
 *
 * ⚠️ **생성 쪽 로고 모드(`AWARD_LOGO_LOOK`)는 지우지 않았다.** `buildProfile({withLogo:true})`
 *    로 그대로 불러 쓸 수 있다 — 화면만 뗀 것이다. 다시 붙일 때 프롬프트를 새로 짤 필요가 없다.
 *    `api/` 를 배포 안 하면서도 남겨 둔 것과 같은 판단이다.
 */
function imageHTML(profile) {
  const photo = needsPhoto(profile);
  const award = profile.typeId === 'awards';
  return `
    <div class="field">
      <label class="field__label" for="p-img">프로필 이미지 프롬프트 (영문)</label>
      <textarea class="textarea" id="p-img" rows="4" readonly>${esc(profile.imagePrompt)}</textarea>
      <p class="field__hint">
        프롬프트를 복사해 이미지 도구에 붙여 쓰시면 됩니다. 정사각형 아바타 기준입니다.
        ${photo ? '<b>본인 얼굴 사진을 함께 첨부</b>해야 이 프롬프트가 제 일을 합니다.' : ''}
        ${award ? '엠블럼에 <b>글자가 들어갑니다</b> — 만든 뒤 철자가 맞는지 꼭 눈으로 확인해 주세요. 이미지 도구는 글자를 자주 틀립니다.' : ''}
      </p>
    </div>

    ${photoRowHTML()}`;
}

/**
 * 아바타 미리보기용 사진 올리기.
 *
 * ⚠️ **여기서 이미지를 만들지 않는다.** 이 앱은 이미지 API 를 쓰지 않는다(8절 결정).
 *    올린 사진은 "프로필에 넣으면 이렇게 보인다"를 확인하는 용도다 — 프롬프트로 만든
 *    결과물을 올려 봐도 되고, 사진형이면 넣을 얼굴 사진을 올려 봐도 된다.
 */
function photoRowHTML() {
  const p = getState().profile;
  const photo = p ? needsPhoto(p) : false;
  return `
    <div class="field" id="p-photo-row">
      <span class="field__label">${photo ? '얼굴 사진 올리기' : '만든 이미지 올려 보기'}</span>
      <div class="keybar__actions">
        <label class="btn btn--soft btn--sm" for="p-photo">
          ${icon('image', 'icon--sm')} 파일 선택
          <input class="sr-only" type="file" id="p-photo" accept="image/*" />
        </label>
        ${avatarUrl ? `
          <button type="button" class="btn btn--text btn--sm" id="p-photo-clear"
                  aria-label="올린 이미지 지우기">지우기</button>` : ''}
      </div>
      <p class="field__hint">
        ${avatarUrl
          ? '왼쪽 미리보기의 프로필 자리에 적용했습니다. 실제 인스타에서도 원형으로 잘립니다.'
          : '올리면 왼쪽 미리보기의 프로필 자리에 바로 넣어 드립니다. 이 기기에만 저장되고 계정에 올라가지는 않습니다.'}
      </p>
    </div>`;
}

/** 사진 줄만 다시 그린다 — 폼 전체를 다시 그리면 입력 중이던 캐럿이 튄다 */
function refreshPhotoRow(root) {
  const row = root.querySelector('#p-photo-row');
  if (!row) return;
  row.outerHTML = photoRowHTML();
  bindPhoto(root);
}

function refreshDraft(root) {
  const slot = root.querySelector('#draft-slot');
  if (!slot) return;
  slot.innerHTML = draftHTML(getState().profile);
  bindDraft(root);
}

/* ---------------- 이벤트 ---------------- */

/**
 * 유형 라디오는 **한 번만** 묶는다. 이 라디오는 다시 그려지지 않는다.
 *
 * ⚠️ 예전에는 브랜드 라디오와 한 함수에 있었고 `remake()` 가 그 함수를 통째로 다시 불렀다.
 *    브랜드 라디오만 새로 그려졌는데 유형 라디오까지 다시 묶여서 **리스너가 쌓였다** —
 *    「다시 뽑기」를 세 번 누른 뒤 유형을 바꾸면 토스트가 네 번 떴다.
 *    다시 그리는 것과 다시 묶는 것을 짝지어 둘 것.
 */
function bindType(root) {
  root.querySelectorAll('input[name="ptype"]').forEach((el) => {
    el.addEventListener('change', () => {
      // 유형이 바뀌면 초안을 처음부터 다시 뽑는다 — 유형별로 구조가 완전히 다르다
      remake(root, { typeId: el.value, brandId: AWARD_BRANDS[0].id, marketerStyle: 'symbol', seed: 0 });
      toast('프로필 초안을 만들었습니다.');
    });
  });
  bindBrand(root);
  bindMarketerStyle(root);
}

/** 브랜드 라디오 — `#brand-slot` 을 다시 그릴 때마다 함께 다시 묶는다 */
function bindBrand(root) {
  root.querySelectorAll('input[name="pbrand"]').forEach((el) => {
    el.addEventListener('change', () => {
      const s = getState();
      // 브랜드만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 브랜드 비교가 된다
      remake(root, { typeId: 'awards', brandId: el.value, seed: s.profileSeed ?? 0 });
    });
  });
}

/** 마케터 아바타 방식 라디오 — `#marketer-style-slot` 을 다시 그릴 때마다 함께 다시 묶는다 */
function bindMarketerStyle(root) {
  root.querySelectorAll('input[name="pmstyle"]').forEach((el) => {
    el.addEventListener('change', () => {
      const s = getState();
      // 방식만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 비교가 된다
      remake(root, { typeId: 'marketer', marketerStyle: el.value, seed: s.profileSeed ?? 0 });
    });
  });
}

/** 초안을 다시 만들고 화면을 맞춘다 */
function remake(root, opts) {
  setState({ profile: buildProfile(opts), profileSeed: opts.seed });
  const brandSlot = root.querySelector('#brand-slot');
  if (brandSlot) brandSlot.innerHTML = brandHTML(getState().profile);
  const styleSlot = root.querySelector('#marketer-style-slot');
  if (styleSlot) styleSlot.innerHTML = marketerStyleHTML(getState().profile);
  refreshDraft(root);
  refreshPreview(root);
  bindBrand(root);          // 브랜드 라디오만 새로 그려졌다 — 유형 라디오는 건드리지 않는다
  bindMarketerStyle(root);  // 마케터 방식 라디오도 마찬가지
}

function bindDraft(root) {
  const s = () => getState();

  root.querySelector('#p-regen')?.addEventListener('click', () => {
    const p = s().profile;
    remake(root, {
      typeId: p.typeId, brandId: p.brandId, marketerStyle: p.marketerStyle ?? 'symbol',
      seed: (s().profileSeed ?? 0) + 1,
    });
  });

  // 편집한 값은 그대로 저장한다. 화면을 다시 그리면 캐럿이 튀므로 여기서는 상태만 갱신한다.
  root.querySelector('#p-name')?.addEventListener('input', (e) => {
    setState({ profile: { ...s().profile, name: e.target.value } });
    refreshPreview(root);
  });

  root.querySelector('#p-bio')?.addEventListener('input', (e) => {
    setState({ profile: { ...s().profile, bio: e.target.value } });
    refreshPreview(root);
  });

  root.querySelector('#p-slug')?.addEventListener('input', (e) => {
    const slug = littlySlug(e.target.value, s().profile.typeId);
    // 소개 안의 🔗 줄만 갈아 끼운다. 통째로 다시 만들면 사용자가 고친 소개가 날아간다.
    const bio = replaceLinkLine(s().profile.bio, slug);
    setState({ profile: { ...s().profile, slug, link: littlyUrl(slug), bio } });

    // 주소를 따로 보여주던 줄은 화면에서 뺐다. `link` 는 「전체 복사」가 계속 쓰므로 상태에는 남긴다.
    const bioEl = root.querySelector('#p-bio');
    if (bioEl && bioEl.value !== bio) bioEl.value = bio;   // 캐럿이 슬러그 칸에 있으므로 안전하다
    refreshPreview(root);
  });

  root.querySelector('#p-copy')?.addEventListener('click', () => {
    const p = s().profile;
    copyText([
      `[이름]\n${p.name}`,
      `[소개]\n${p.bio}`,
      `[링크]\n${p.link}`,
      `[프로필 이미지 프롬프트]\n${p.imagePrompt}`,
    ].join('\n\n'), '프로필을 복사했습니다.');
  });

  root.querySelector('#p-copy-img')?.addEventListener('click', () => {
    copyText(s().profile.imagePrompt, '이미지 프롬프트를 복사했습니다.');
  });

  bindPhoto(root);
}

function bindPhoto(root) {
  root.querySelector('#p-photo')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('이미지 파일만 올릴 수 있습니다.'); return; }
    try {
      await putImage(AVATAR_KEY, file);
      avatarUrl = objectUrl(file);
      refreshPreview(root);
      refreshPhotoRow(root);
      toast('미리보기에 적용했습니다.');
    } catch {
      // 저장이 막혀도 이번 화면에서는 보여 준다 — 새로고침하면 사라진다는 것만 알린다
      avatarUrl = objectUrl(file);
      refreshPreview(root);
      refreshPhotoRow(root);
      toast('미리보기에만 적용했습니다. 저장에 실패해 새로고침하면 사라집니다.');
    }
  });

  root.querySelector('#p-photo-clear')?.addEventListener('click', async () => {
    avatarUrl = null;
    try { await deleteImage(AVATAR_KEY); } catch { /* 지우기 실패는 화면을 막지 않는다 */ }
    refreshPreview(root);
    refreshPhotoRow(root);
    toast('올린 이미지를 지웠습니다.');
  });
}

/* ---------------- 유틸 ---------------- */

async function copyText(text, okMessage) {
  if (!String(text).trim()) { toast('복사할 내용이 없습니다.'); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    // 권한이 막힌 환경 폴백 — 2단계와 같은 방식
    const tmp = document.createElement('textarea');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
    toast(okMessage);
  }
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const escAttr = esc;
