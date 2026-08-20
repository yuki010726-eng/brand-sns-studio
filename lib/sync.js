/**
 * 작업 내용 동기화 — 로그인한 계정 기준으로 기기 간에 이어서 쓴다
 *
 * 요청자 요구(2026-08-03): 집 PC 에서 쓴 걸 회사 PC 에서 이어서 보고 싶다.
 * 여태 코드만 git 으로 오갔고 작업 내용은 브라우저에 남아 기기를 따라가지 않았다.
 *
 * 범위: **글·문구만.** 이미지(IndexedDB Blob)는 게시물 하나에 6장 × 약 1MB 라
 * 무료 용량을 금방 쓴다. 요청자 결정에 따라 1차에서는 제외한다.
 *
 * ⚠️ 로그인하지 않았거나 설정이 없으면 **아무 일도 하지 않는다.** 앱은 그대로 동작한다.
 */
import { getClient } from './supabase.js';
import { getUser } from './auth.js';

const TABLE = 'studio_state';

/**
 * 동기화할 상태 키.
 *
 * ⚠️ `images` 는 넣지 않는다. 그건 '이 기기에 어떤 이미지가 있는지'를 적어 둔 값이라,
 *    실제 Blob 이 없는 기기로 옮기면 있지도 않은 이미지가 있다고 표시된다.
 *    이미지까지 옮기려면 Storage 를 붙여야 한다 — 별도 작업이다.
 */
const SYNCED_KEYS = [
  'profile', 'profileSeed',
  'productId', 'topic', 'tone', 'channels', 'cardCount',
  'drafts', 'generated', 'variants', 'sources', 'draftKey', 'aiKey', 'outline', 'researchStyle',
  'aiRuns', 'activeAiRun',
  'concept', 'accent', 'mark', 'cardTheme', 'noteSymbol', 'notePaper', 'noteGrain',
  'card', 'library',
];

export const pickSynced = (state) => {
  const out = {};
  for (const k of SYNCED_KEYS) if (state[k] !== undefined) out[k] = state[k];
  return out;
};

/** 마지막으로 서버에서 받아온 시각. 다른 기기가 그 뒤에 고쳤는지 판단하는 기준이다. */
let lastPulledAt = null;

/** 서버에서 받아 상태에 적용하는 중에는 다시 올리지 않는다 (되먹임 방지) */
let applying = false;
export const isApplying = () => applying;

/**
 * 서버에 저장된 내 작업 내용을 가져온다.
 * @returns {Promise<{state:object, updatedAt:string}|null>}
 */
export async function pull() {
  const user = getUser();
  const sb = await getClient();
  if (!user || !sb) return null;

  const { data, error } = await sb
    .from(TABLE)
    .select('state, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[sync] 불러오기 실패', error.message);
    return null;
  }
  if (!data) { lastPulledAt = new Date().toISOString(); return null; }

  lastPulledAt = data.updated_at;
  return { state: data.state || {}, updatedAt: data.updated_at };
}

/**
 * 내 작업 내용을 저장한다.
 *
 * 마지막 저장이 이긴다(last-write-wins). 두 기기에서 동시에 고치는 상황은 드물고,
 * 자동 병합은 글을 뒤섞어 더 나쁜 결과를 만든다. 대신 다른 기기가 먼저 고쳤으면
 * hasRemoteChange() 로 **알려주고 사용자가 고르게** 한다.
 */
export async function push(state) {
  const user = getUser();
  const sb = await getClient();
  if (!user || !sb || applying) return { ok: false };

  const now = new Date().toISOString();
  const { error } = await sb.from(TABLE).upsert({
    user_id: user.id,
    state: pickSynced(state),
    updated_at: now,
  });

  if (error) {
    console.warn('[sync] 저장 실패', error.message);
    return { ok: false, error: error.message };
  }
  lastPulledAt = now;
  return { ok: true, at: now };
}

/** 내가 마지막으로 받아온 뒤에 다른 기기가 고쳤는지 */
export async function hasRemoteChange() {
  const user = getUser();
  const sb = await getClient();
  if (!user || !sb || !lastPulledAt) return false;

  const { data } = await sb
    .from(TABLE)
    .select('updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return Boolean(data?.updated_at && data.updated_at > lastPulledAt);
}

/** 서버 내용을 상태에 얹는다. 얹는 동안에는 다시 올리지 않는다. */
export function applyRemote(remoteState, setState) {
  applying = true;
  try {
    setState(remoteState);
  } finally {
    // setState 로 걸린 구독자들이 다 돈 뒤에 풀어야 한다
    queueMicrotask(() => { applying = false; });
  }
}

/* ---------------- 자동 저장 ---------------- */

let timer = null;
let pending = null;

/**
 * 상태가 바뀔 때마다 부른다. 타이핑 한 글자마다 올리면 요청이 폭발하므로 모아서 보낸다.
 * @param {object} state
 * @param {(info:{ok:boolean, at?:string}) => void} [onDone]
 */
export function scheduleSync(state, onDone) {
  if (!getUser() || applying) return;
  pending = state;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const s = pending;
    pending = null;
    const r = await push(s);
    onDone?.(r);
  }, 1500);
}

/** 창을 닫기 전 마지막 저장 — 디바운스를 기다리지 않는다 */
export async function flushSync(state) {
  clearTimeout(timer);
  pending = null;
  return push(state);
}
