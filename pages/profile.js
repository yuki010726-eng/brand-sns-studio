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
  buildProfile, littlySlug, littlyUrl, replaceLinkLine,
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
 */
function brandHTML(profile) {
  if (profile?.typeId !== 'awards') return '';
  return `
    <fieldset class="field" style="margin-top:var(--gap)">
      <legend class="field__label">어느 브랜드인가요?</legend>
      <ul class="channel-row">
        ${AWARD_BRANDS.map((b) => `
          <li>
            <input class="sr-only channel__input" type="radio" name="pbrand" id="pbrand-${b.id}"
                   value="${b.id}" autocomplete="off"
                   aria-label="${escAttr(b.label)} — 주소 litt.ly/${escAttr(b.slug)}"
                   ${profile.brandId === b.id ? 'checked' : ''} />
            <label class="channel" for="pbrand-${b.id}">
              ${icon('award', 'icon--sm')}
              <span>
                <strong>${esc(b.label)}</strong>
                <em>litt.ly/${esc(b.slug)}</em>
              </span>
            </label>
          </li>`).join('')}
      </ul>
    </fieldset>`;
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
        <p class="field__hint" id="p-link">${esc(profile.link)} · 소개 맨 마지막 줄에 함께 들어갑니다.</p>
        <p class="field__hint">
          litt.ly 계정이 없다면 —
          <a href="${LITTLY_SIGNUP}" target="_blank" rel="noopener noreferrer">litt.ly 만들기</a>
        </p>
      </div>

      <div class="field">
        <label class="field__label" for="p-img">프로필 이미지 프롬프트 (영문)</label>
        <textarea class="textarea" id="p-img" rows="3" readonly>${esc(profile.imagePrompt)}</textarea>
        <p class="field__hint">
          이미지 생성 API는 다음에 붙입니다. 지금은 프롬프트를 복사해 쓰시면 됩니다.
          정사각형 아바타 기준이고, 글자는 넣지 않습니다.
        </p>
      </div>

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

function refreshDraft(root) {
  const slot = root.querySelector('#draft-slot');
  if (!slot) return;
  slot.innerHTML = draftHTML(getState().profile);
  bindDraft(root);
}

/* ---------------- 이벤트 ---------------- */

function bindType(root) {
  root.querySelectorAll('input[name="ptype"]').forEach((el) => {
    el.addEventListener('change', () => {
      // 유형이 바뀌면 초안을 처음부터 다시 뽑는다 — 유형별로 구조가 완전히 다르다
      remake(root, { typeId: el.value, brandId: AWARD_BRANDS[0].id, seed: 0 });
      toast('프로필 초안을 만들었습니다.');
    });
  });

  root.querySelectorAll('input[name="pbrand"]').forEach((el) => {
    el.addEventListener('change', () => {
      const s = getState();
      // 브랜드만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 브랜드 비교가 된다
      remake(root, { typeId: 'awards', brandId: el.value, seed: s.profileSeed ?? 0 });
    });
  });
}

/** 초안을 다시 만들고 화면을 맞춘다 */
function remake(root, opts) {
  setState({ profile: buildProfile(opts), profileSeed: opts.seed });
  const brandSlot = root.querySelector('#brand-slot');
  if (brandSlot) brandSlot.innerHTML = brandHTML(getState().profile);
  refreshDraft(root);
  bindType(root);   // 브랜드 라디오가 새로 그려졌으므로 다시 묶는다
}

function bindDraft(root) {
  const s = () => getState();

  root.querySelector('#p-regen')?.addEventListener('click', () => {
    const p = s().profile;
    remake(root, { typeId: p.typeId, brandId: p.brandId, seed: (s().profileSeed ?? 0) + 1 });
  });

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
    if (hint) hint.textContent = `${littlyUrl(slug)} · 소개 맨 마지막 줄에 함께 들어갑니다.`;
    const bioEl = root.querySelector('#p-bio');
    if (bioEl && bioEl.value !== bio) bioEl.value = bio;   // 캐럿이 슬러그 칸에 있으므로 안전하다
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
