/**
 * 1단계 — 인스타그램 프로필 세팅
 *
 * 흐름은 요청자가 정한 순서 그대로다.
 *   ① 브랜드 어워즈형 / 마케터형 선택
 *   ② 그 유형에 맞게 이름·프로필 이미지·소개를 무작위 제작
 *   ③ litt.ly 링크 추가
 *
 * 이미지 생성 API 연결은 다음 작업이다(요청자 지시). 지금은 **영문 프롬프트까지** 만들어 둔다.
 */
import { icon } from '../assets/icons.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate } from '../store.js';
import { toast } from '../components/toast.js';
import {
  PROFILE_TYPES, AWARD_BRANDS, LIMITS, LITTLY_SIGNUP,
  buildProfile, littlySlug, littlyUrl, replaceLinkLine, awardLogoSrc,
} from '../lib/profile.js';

export const title = '프로필 세팅';

export function render(root) {
  const s = getState();
  const profile = s.profile;

  root.innerHTML = `
    <div class="container">
      <section class="hero">
        <p class="hero__eyebrow">${icon('sparkles', 'icon--sm')} 프로필 세팅 → 상품·주제 → 아이디어 문서화 → 카드뉴스</p>
        <h1>먼저 계정 프로필부터 잡을까요?</h1>
        <p class="hero__sub">
          유형을 고르면 이름·소개·프로필 이미지 초안을 만들어 드립니다.
          마음에 안 들면 「다시 뽑기」를 누르시면 됩니다.
        </p>
      </section>

      ${stepperHTML('/profile')}

      <section class="section" aria-labelledby="sec-type">
        <div class="section__head">
          <h2 id="sec-type">1. 계정 유형</h2>
          <p class="section__desc">요청자가 주신 인스타그램 레퍼런스를 분석해 두 갈래로 나눴습니다.</p>
        </div>

        <ul class="channel-row">
          ${PROFILE_TYPES.map((t) => `
            <li>
              <input class="sr-only channel__input" type="radio" name="ptype" id="ptype-${t.id}"
                     value="${t.id}" autocomplete="off"
                     aria-label="${escAttr(t.label)} — ${escAttr(t.desc)}"
                     ${profile?.typeId === t.id ? 'checked' : ''} />
              <label class="channel" for="ptype-${t.id}">
                ${icon('sparkles', 'icon--sm')}
                <span>
                  <strong>${esc(t.label)}</strong>
                  <em>${esc(t.desc)}</em>
                  <em>레퍼런스 · ${esc(t.refs)}</em>
                </span>
              </label>
            </li>`).join('')}
        </ul>

        <div id="brand-slot">${brandHTML(profile)}</div>
      </section>

      <section class="section" aria-labelledby="sec-draft">
        <div class="section__head">
          <h2 id="sec-draft">2. 이름 · 소개 · 프로필 이미지</h2>
          <p class="section__desc">인스타 제한에 맞춰 이름 ${LIMITS.name}자, 소개 ${LIMITS.bio}자 안에서 만듭니다.</p>
        </div>
        <div id="draft-slot">${draftHTML(profile)}</div>
      </section>

      <div class="flow-actions">
        <button type="button" class="btn btn--lg" id="go-home"
                aria-label="상품·주제 선택 단계로 이동">
          상품·주제 선택하기 ${icon('arrowRight', 'icon--sm')}
        </button>
      </div>
    </div>`;

  bindStepper(root);
  bindType(root);
  bindDraft(root);

  root.querySelector('#go-home')?.addEventListener('click', () => navigate('/'));
}

/* ---------------- 브랜드 선택 (어워즈형 전용) ---------------- */

/**
 * 어워즈형은 어느 브랜드 계정인지에 따라 이름·사실·litt.ly 주소가 전부 달라진다.
 * 승인된 상품 4종에서 가져오므로 여기서 행사명을 지어내지 않는다.
 *
 * ⚠️ `<fieldset>` 을 쓰지 않는다. 브라우저 기본 테두리(2px groove)가 그대로 살아
 *    검은 네모 상자로 보였다 — 요청자 지적(2026-08-11).
 *    `.field` 에는 테두리 해제가 없고, `.brief__form fieldset` 규칙은 2단계 전용이라
 *    여기까지 오지 않는다. 대신 유형 선택 바로 아래에 붙는 **하위 패널**로 만든다.
 *    라디오 묶음의 접근성은 `role="radiogroup"` + `aria-labelledby` 로 유지한다.
 */
function brandHTML(profile) {
  if (profile?.typeId !== 'awards') return '';
  const current = AWARD_BRANDS.find((b) => b.id === profile.brandId) || AWARD_BRANDS[0];
  return `
    <div class="subpanel">
      <p class="subpanel__label" id="pbrand-label">어느 브랜드인가요?</p>
      <!-- 한 줄짜리 칩으로 둔다. 예전에는 4개가 큰 카드로 세로로 쌓여 화면을 다 먹었다. -->
      <div class="pickrow" role="radiogroup" aria-labelledby="pbrand-label">
        ${AWARD_BRANDS.map((b) => `
          <input class="sr-only pick__input" type="radio" name="pbrand" id="pbrand-${b.id}"
                 value="${b.id}" autocomplete="off"
                 aria-label="${escAttr(b.label)} — 주소 litt.ly/${escAttr(b.slug)}"
                 ${profile.brandId === b.id ? 'checked' : ''} />
          <label class="pick" for="pbrand-${b.id}" title="litt.ly/${escAttr(b.slug)}">${esc(b.short)}</label>
        `).join('')}
      </div>
      <p class="subpanel__hint">${esc(current.label)} · litt.ly/${esc(current.slug)}</p>
    </div>`;
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

      <div class="field">
        <label class="field__label" for="p-slug">링크 (litt.ly)</label>
        <div class="inline-field">
          <span class="inline-field__prefix">litt.ly/</span>
          <input class="input" id="p-slug" value="${escAttr(profile.slug)}"
                 autocomplete="off" spellcheck="false" aria-describedby="p-link" />
        </div>
        <!-- 「소개 맨 마지막 줄에 함께 들어갑니다」 안내는 뺐다 — 칸마다 두 줄씩 붙어
             화면이 번잡했다(요청자 지적 2026-08-11). 동작은 그대로다. -->
        <p class="field__hint" id="p-link">${esc(profile.link)}</p>
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
 * 어워즈형은 **로고를 첨부해서 만드는 길**이 따로 있다 (요청자 요구 2026-08-11).
 *
 * 로고를 첨부하면 프롬프트가 심볼을 지시하지 않고 주변 연출만 말한다.
 * 예전처럼 `a laurel wreath award emblem …` 으로 시작하면 모델이 로고를 무시하고
 * 글로 적힌 심볼을 그린다 — 월계수만 나오던 원인이다. `lib/profile.js` 주석 참고.
 *
 * 로고 파일은 아직 저장소에 없다. 없으면 `<img>` 가 실패하고 안내문으로 바뀐다.
 */
function imageHTML(profile) {
  const isAwards = profile.typeId === 'awards';
  const brand = isAwards
    ? (AWARD_BRANDS.find((b) => b.id === profile.brandId) || AWARD_BRANDS[0])
    : null;

  return `
    <div class="field">
      <label class="field__label" for="p-img">프로필 이미지 프롬프트 (영문)</label>

      ${isAwards ? `
        <div class="logobar">
          <div class="logobar__thumb">
            <!-- 파일이 없으면 이 img 는 실패한다. 그때 안내문을 대신 보여준다. -->
            <img src="${escAttr(awardLogoSrc(brand.id))}" alt="${escAttr(brand.label)} 로고"
                 id="p-logo-img" width="72" height="72" />
            <span class="logobar__empty" id="p-logo-empty" hidden>로고 준비 중</span>
          </div>
          <div class="logobar__body">
            <strong>${esc(brand.short)} 로고</strong>
            <p>로고를 함께 넣으면 그 마크가 들어간 프로필이 나옵니다.
               넣지 않으면 프롬프트가 심볼을 직접 지어냅니다.</p>
            <div class="logobar__actions">
              <a class="btn btn--soft btn--sm" id="p-logo-dl"
                 href="${escAttr(awardLogoSrc(brand.id))}" download
                 aria-label="${escAttr(brand.short)} 로고 내려받기">
                ${icon('download', 'icon--sm')} 로고 내려받기
              </a>
              <input class="sr-only pick__input" type="checkbox" id="p-logo-on"
                     autocomplete="off" ${profile.withLogo ? 'checked' : ''}
                     aria-label="로고를 첨부해서 만드는 프롬프트로 바꾸기" />
              <label class="pick" for="p-logo-on">로고 첨부해서 만들기</label>
            </div>
          </div>
        </div>` : ''}

      <textarea class="textarea" id="p-img" rows="${profile.withLogo ? 6 : 3}" readonly>${esc(profile.imagePrompt)}</textarea>

      <p class="field__hint">
        ${profile.withLogo
          ? `<b>로고와 이 프롬프트를 같이 넣으세요.</b> 로고가 곧 심볼이라 프롬프트는 주변 연출만 말합니다.
             배치는 모델에게 맡겨 두었으니, 마음에 안 들면 「다시 뽑기」로 연출을 바꿔 보세요.`
          : `프롬프트를 복사해 이미지 도구에 붙여 쓰시면 됩니다.
             정사각형 아바타 기준이고, 글자는 넣지 않습니다.`}
      </p>
    </div>`;
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
      remake(root, { typeId: el.value, brandId: AWARD_BRANDS[0].id, seed: 0 });
      toast('프로필 초안을 만들었습니다.');
    });
  });
  bindBrand(root);
}

/** 브랜드 라디오 — `#brand-slot` 을 다시 그릴 때마다 함께 다시 묶는다 */
function bindBrand(root) {
  root.querySelectorAll('input[name="pbrand"]').forEach((el) => {
    el.addEventListener('change', () => {
      const s = getState();
      // 브랜드만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 브랜드 비교가 된다.
      // 로고 첨부 여부도 유지한다 — 브랜드를 바꿔 보는 동안 토글이 꺼지면 매번 다시 켜야 한다.
      remake(root, {
        typeId: 'awards', brandId: el.value,
        seed: s.profileSeed ?? 0, withLogo: s.profile?.withLogo,
      });
    });
  });
}

/** 초안을 다시 만들고 화면을 맞춘다 */
function remake(root, opts) {
  setState({ profile: buildProfile(opts), profileSeed: opts.seed });
  const brandSlot = root.querySelector('#brand-slot');
  if (brandSlot) brandSlot.innerHTML = brandHTML(getState().profile);
  refreshDraft(root);
  bindBrand(root);   // 브랜드 라디오만 새로 그려졌다 — 유형 라디오는 건드리지 않는다
}

function bindDraft(root) {
  const s = () => getState();

  root.querySelector('#p-regen')?.addEventListener('click', () => {
    const p = s().profile;
    remake(root, {
      typeId: p.typeId, brandId: p.brandId,
      seed: (s().profileSeed ?? 0) + 1, withLogo: p.withLogo,
    });
  });

  /**
   * 로고 첨부 토글 — seed 는 그대로 두고 **프롬프트만** 갈아 끼운다.
   * seed 를 올리면 켰다 껐다 할 때마다 연출이 달라져서 두 모드를 비교할 수 없다.
   */
  root.querySelector('#p-logo-on')?.addEventListener('change', (e) => {
    const p = s().profile;
    remake(root, {
      typeId: p.typeId, brandId: p.brandId,
      seed: s().profileSeed ?? 0, withLogo: e.target.checked,
    });
  });

  /**
   * 로고 파일이 아직 없으면 깨진 이미지 대신 안내를 보여준다.
   * 파일이 들어오면 이 분기는 자연히 안 탄다 — 화면 코드를 다시 고칠 필요가 없다.
   */
  const logoImg = root.querySelector('#p-logo-img');
  if (logoImg) {
    const markMissing = () => {
      logoImg.hidden = true;
      const empty = root.querySelector('#p-logo-empty');
      if (empty) empty.hidden = false;
      // 없는 파일을 내려받게 두면 404 페이지가 저장된다
      const dl = root.querySelector('#p-logo-dl');
      if (dl) {
        dl.classList.add('is-disabled');
        dl.setAttribute('aria-disabled', 'true');
        dl.removeAttribute('href');
      }
    };
    logoImg.addEventListener('error', markMissing);
    // 캐시에서 즉시 실패했으면 error 가 이미 지나갔을 수 있다
    if (logoImg.complete && logoImg.naturalWidth === 0) markMissing();
  }

  // 편집한 값은 그대로 저장한다. 화면을 다시 그리면 캐럿이 튀므로 여기서는 상태만 갱신한다.
  root.querySelector('#p-name')?.addEventListener('input', (e) => {
    setState({ profile: { ...s().profile, name: e.target.value } });
  });

  root.querySelector('#p-bio')?.addEventListener('input', (e) => {
    setState({ profile: { ...s().profile, bio: e.target.value } });
  });

  root.querySelector('#p-slug')?.addEventListener('input', (e) => {
    const slug = littlySlug(e.target.value, s().profile.typeId);
    // 소개 안의 🔗 줄만 갈아 끼운다. 통째로 다시 만들면 사용자가 고친 소개가 날아간다.
    const bio = replaceLinkLine(s().profile.bio, slug);
    setState({ profile: { ...s().profile, slug, link: littlyUrl(slug), bio } });

    const hint = root.querySelector('#p-link');
    if (hint) hint.textContent = littlyUrl(slug);
    const bioEl = root.querySelector('#p-bio');
    if (bioEl && bioEl.value !== bio) bioEl.value = bio;   // 캐럿이 슬러그 칸에 있으므로 안전하다
  });

  root.querySelector('#p-copy')?.addEventListener('click', () => {
    const p = s().profile;
    // 로고 모드는 프롬프트만 붙여넣으면 반쪽이다 — 로고를 함께 넣어야 한다는 걸 같이 적는다
    const imgLabel = p.withLogo
      ? '[프로필 이미지 프롬프트 · 로고 파일을 함께 첨부하세요]'
      : '[프로필 이미지 프롬프트]';
    copyText([
      `[이름]\n${p.name}`,
      `[소개]\n${p.bio}`,
      `[링크]\n${p.link}`,
      `${imgLabel}\n${p.imagePrompt}`,
    ].join('\n\n'), '프로필을 복사했습니다.');
  });

  root.querySelector('#p-copy-img')?.addEventListener('click', () => {
    copyText(s().profile.imagePrompt, '이미지 프롬프트를 복사했습니다.');
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
