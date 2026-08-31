/**
 * 보관함 — 만든 게시물을 통째로 담아 두고 나중에 이어서 편집한다 (STEP 5)
 *
 * 왜 필요한가
 * 여태 이 앱은 **게시물을 한 번에 하나만** 들고 있었다. 상품이나 주제를 바꾸면
 * 앞서 쓴 글은 그냥 사라졌다. 요청자 요구: 만든 걸 남겨 두고 나중에 다시 꺼내 쓴다.
 *
 * 저장 시점 — AI 결과가 처음 만들어지면 즉시 보관하고, 카드뉴스 편집 중에는 자동 저장한다.
 *
 * 담는 것 — 글·문구·템플릿 설정 전부 (`POST_KEYS`). 이미지는 **썸네일 1장만** 남긴다.
 * 원본 6장은 게시물당 6MB 라 몇십 개만 쌓여도 브라우저 용량을 넘긴다 (요청자 결정).
 *
 * ⚠️ 프로필(`profile`)은 담지 않는다. 게시물이 아니라 **계정** 정보라서
 *    옛 게시물을 불러왔다고 프로필까지 과거로 되돌리면 안 된다.
 */
import { getState, setState, lastPersistError } from '../store.js';
import { putImage, getImage, deleteImage, imageKey } from './imagestore.js';
import { getActiveInstagramAccountId } from './instagram-accounts.js';

const EDIT_SESSION_KEY = 'bboggl.library-edit-id';

/** 현재 작업이 보관함에서 불러온 항목의 편집인지 구분한다. */
export const getLibraryEditId = () => sessionStorage.getItem(EDIT_SESSION_KEY);
export const clearLibraryEdit = () => sessionStorage.removeItem(EDIT_SESSION_KEY);

/** 게시물 한 건을 되살리는 데 필요한 상태 키 */
export const POST_KEYS = [
  'productId', 'topic', 'focusPoint', 'contentOutline', 'libraryTitle', 'tone', 'customStyleUrl', 'customStyleGuide', 'customStyleGuideUrl', 'channels', 'cardCount',
  'drafts', 'generated', 'variants', 'sources', 'draftKey', 'aiKey', 'outline', 'researchStyle',
  'aiRuns', 'activeAiRun',
  'concept', 'accent', 'mark', 'cardTheme', 'noteSymbol', 'notePaper', 'noteGrain',
  'card', 'image', 'images', 'postId',
];

/**
 * 게시물의 신원 = 상품 + 보관함 이름(별도 이름이 없으면 주제).
 * "다른 이름으로 저장" 사본은 원래 주제를 유지하면서도 별도 항목이어야 한다.
 * 톤이나 템플릿을 바꿔 가며 다듬는 건 **같은 게시물을 고치는 것**이므로 새 항목을 만들지 않는다.
 */
export const postKeyOf = (s) => {
  const title = String(s.libraryTitle || s.topic || '').trim();
  return `${s.productId}|${title}`;
};

/** 썸네일은 이미지와 같은 IndexedDB 를 쓴다. 항목 id 로 키를 잡아 게시물끼리 섞이지 않게 한다. */
export const thumbKey = (id) => `lib-thumb-${id}`;

const newId = () => `lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** 참조를 끊어서 담는다. 안 그러면 이후 편집이 보관함 항목까지 따라 바뀐다. */
export const librarySnapshot = (state) => {
  const out = {};
  for (const k of POST_KEYS) if (state[k] !== undefined) out[k] = state[k];
  return JSON.parse(JSON.stringify(out));
};

/** 현재 작업이 보관함의 마지막 저장본과 다른지 확인한다. */
export function hasLibraryChanges(state = getState()) {
  const editingId = getLibraryEditId();
  const activeInstagramAccountId = getActiveInstagramAccountId();
  const item = editingId
    ? getLibrary().find((it) => it.id === editingId)
    : getLibrary().find((it) => it.postKey === postKeyOf(state)
      && String(it.instagramAccountId || '') === activeInstagramAccountId);
  if (!item) return true;
  return JSON.stringify(librarySnapshot(state)) !== JSON.stringify(item.state);
}

export const getLibrary = () => {
  const list = getState().library;
  return Array.isArray(list) ? list : [];
};

export const findItem = (id) => getLibrary().find((it) => it.id === id) || null;

/**
 * 지금 작업 중인 게시물을 보관함에 넣는다. 같은 상품·주제가 이미 있으면 덮어쓴다.
 *
 * @param {object} state 현재 전역 상태
 * @param {Blob|null} [thumbBlob] 첫 카드 썸네일 (없으면 목록에 글자만 나온다)
 * @returns {Promise<{ok:boolean, replaced?:boolean, item?:object, error?:string}>}
 */
export async function saveToLibrary(state, thumbBlob = null) {
  if (!state.productId || !String(state.topic || '').trim()) {
    return { ok: false, error: '상품과 주제가 있어야 보관할 수 있습니다.' };
  }

  const before = getLibrary();
  const key = postKeyOf(state);
  const activeInstagramAccountId = getActiveInstagramAccountId();
  const editingId = getLibraryEditId();
  const editingAt = editingId ? before.findIndex((it) => it.id === editingId) : -1;
  const at = editingAt >= 0
    ? editingAt
    : before.findIndex((it) => it.postKey === key
      && String(it.instagramAccountId || '') === activeInstagramAccountId);
  const id = at >= 0 ? before[at].id : newId();
  const now = new Date().toISOString();

  let hasThumb = false;
  if (thumbBlob) {
    try { await putImage(thumbKey(id), thumbBlob); hasThumb = true; } catch { /* 썸네일은 없어도 된다 */ }
  } else if (at >= 0) {
    hasThumb = Boolean(before[at].hasThumb);   // 새로 못 그렸으면 예전 것을 그대로 둔다
  }

  const item = {
    id,
    postKey: key,
    savedAt: at >= 0 ? before[at].savedAt : now,
    updatedAt: now,
    title: String(state.libraryTitle || state.topic).trim(),
    productId: state.productId,
    tone: state.tone,
    concept: state.concept,
    cardCount: state.cardCount,
    channels: [...(state.channels || [])],
    instagramAccountId: editingAt >= 0
      ? String(before[editingAt].instagramAccountId || '')
      : activeInstagramAccountId,
    hasThumb,
    state: librarySnapshot(state),
  };

  const list = before.slice();
  if (at >= 0) list[at] = item; else list.unshift(item);
  setState({ library: list });

  /**
   * ⚠️ setState 는 용량 초과를 조용히 넘긴다. 그대로 두면 "저장했습니다"라고 해 놓고
   *    새로고침하면 사라진다. 실패했으면 원래 목록으로 되돌리고 사실대로 알린다.
   */
  const failure = lastPersistError();
  if (failure) {
    setState({ library: before });
    if (!before.some((it) => it.id === id)) await deleteImage(thumbKey(id)).catch(() => {});
    return { ok: false, error: '브라우저 저장 공간이 가득 찼습니다. 보관함에서 오래된 게시물을 지운 뒤 다시 시도해 주세요.' };
  }

  sessionStorage.setItem(EDIT_SESSION_KEY, id);
  return { ok: true, replaced: at >= 0, item };
}

/**
 * 보관함에서 지운다. 썸네일도 같이 지운다.
 *
 * ⚠️ 카드 원본 이미지는 건드리지 않는다. 지금은 게시물 단위 키(`postId`)라 남겨 둬도
 *    다른 게시물에 새어 나가지 않는다. 다만 **되돌리기 수단이 없어** 지우면 끝이므로 그대로 둔다.
 *    (`postId` 가 없던 시절 저장분은 여전히 상품·템플릿 단위로 공유된다 — 그때 지우면
 *     같은 상품의 다른 게시물에서 이미지가 사라진다.)
 */
export async function removeFromLibrary(id) {
  const list = getLibrary().filter((it) => it.id !== id);
  setState({ library: list });
  await deleteImage(thumbKey(id)).catch(() => {});
}

/**
 * 보관함 항목을 작업 상태로 되돌린다.
 *
 * ⚠️ 이미지 기록(`images`)은 **저장할 때의 값을 그대로 믿지 않는다.** 그건 '이 기기에
 *    어떤 이미지가 있는지' 적어 둔 값인데, 보관함은 기기 간에 동기화되므로 다른 PC 에서는
 *    있지도 않은 이미지가 있다고 표시된다. IndexedDB 를 실제로 확인해서 다시 세운다.
 */
export async function loadFromLibrary(id) {
  const item = findItem(id);
  if (!item) return { ok: false, error: '항목을 찾을 수 없습니다.' };

  const snap = { ...item.state };
  restoreLegacyRunConditions(snap);
  // AI 1 · AI 2 are separate editable drafts. Keep the whole run history when
  // restoring a post, and clear it for library entries saved before aiRuns was
  // added so another post's runs cannot leak into the restored post.
  const runs = snap.aiRuns;
  if (!runs || typeof runs !== 'object' || !Array.isArray(runs.list)) {
    snap.aiRuns = { key: '', list: [] };
    snap.activeAiRun = null;
  } else if (snap.activeAiRun && typeof snap.activeAiRun === 'object') {
    snap.activeAiRun = Object.fromEntries(Object.entries(snap.activeAiRun).filter(([channelId, index]) => {
      if (!Number.isInteger(index) || index < 0) return false;
      const channelRuns = runs.list.filter((run) => Object.prototype.hasOwnProperty.call(run?.drafts || {}, channelId));
      return index < channelRuns.length;
    }));
  } else if (!Number.isInteger(snap.activeAiRun)
    || snap.activeAiRun < 0
    || snap.activeAiRun >= runs.list.length) {
    snap.activeAiRun = null;
  }
  snap.images = await reconcileImages(snap);
  setState(snap);
  sessionStorage.setItem(EDIT_SESSION_KEY, id);
  return { ok: true, item };
}

/**
 * focusPoint/contentOutline were accidentally omitted from old library snapshots even
 * though both values are part of aiRuns.key. Recover them so saved AI variants (and
 * their chat context keys) remain addressable when an older post is restored.
 */
function restoreLegacyRunConditions(snap) {
  if (Object.prototype.hasOwnProperty.call(snap, 'focusPoint')
    && Object.prototype.hasOwnProperty.call(snap, 'contentOutline')) return;

  const key = typeof snap.aiRuns?.key === 'string' ? snap.aiRuns.key : '';
  const prefix = `${snap.productId}|${String(snap.topic || '').trim()}|`;
  const toneMarker = `|${snap.tone}|`;
  if (!key.startsWith(prefix)) {
    if (!Object.prototype.hasOwnProperty.call(snap, 'focusPoint')) snap.focusPoint = '';
    if (!Object.prototype.hasOwnProperty.call(snap, 'contentOutline')) snap.contentOutline = null;
    return;
  }

  const toneAt = key.indexOf(toneMarker, prefix.length);
  if (toneAt < 0) {
    if (!Object.prototype.hasOwnProperty.call(snap, 'focusPoint')) snap.focusPoint = '';
    if (!Object.prototype.hasOwnProperty.call(snap, 'contentOutline')) snap.contentOutline = null;
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(snap, 'focusPoint')) {
    snap.focusPoint = key.slice(prefix.length, toneAt);
  }

  if (Object.prototype.hasOwnProperty.call(snap, 'contentOutline')) return;
  const tail = key.slice(toneAt + toneMarker.length);
  for (let separator = tail.indexOf('|'); separator >= 0; separator = tail.indexOf('|', separator + 1)) {
    try {
      snap.contentOutline = JSON.parse(tail.slice(separator + 1));
      return;
    } catch { /* the separator may be part of a custom style URL */ }
  }
  snap.contentOutline = null;
}

async function reconcileImages(snap) {
  const saved = snap.images && typeof snap.images === 'object' ? snap.images : {};
  const total = Number(snap.cardCount) || 6;
  const out = {};
  for (let i = 0; i < total; i++) {
    const blob = await getImage(imageKey(snap.productId, snap.concept, i, snap.postId)).catch(() => null);
    if (!blob) continue;
    // 이 기기에 실제로 있는 것만 적는다. 만든 방식을 모르면 업로드본으로 둔다(표시용 문구일 뿐이다).
    out[i] = saved[i] || { source: 'upload', at: Date.now() };
  }
  return out;
}

/** 목록에 쓸 썸네일 Blob (없으면 null) */
export async function getThumb(item) {
  if (!item?.hasThumb) return null;
  return getImage(thumbKey(item.id)).catch(() => null);
}
