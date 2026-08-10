/**
 * 보관함 — 만든 게시물을 통째로 담아 두고 나중에 이어서 편집한다 (STEP 5)
 *
 * 왜 필요한가
 * 여태 이 앱은 **게시물을 한 번에 하나만** 들고 있었다. 상품이나 주제를 바꾸면
 * 앞서 쓴 글은 그냥 사라졌다. 요청자 요구: 만든 걸 남겨 두고 나중에 다시 꺼내 쓴다.
 *
 * 저장 시점 — **수동이다.** 4단계에서 「보관함에 저장」을 누른 것만 들어간다 (요청자 결정).
 * 만들다 만 게시물까지 자동으로 쌓이면 보관함이 금세 쓰레기통이 되기 때문이다.
 *
 * 담는 것 — 글·문구·템플릿 설정 전부 (`POST_KEYS`). 이미지는 **썸네일 1장만** 남긴다.
 * 원본 6장은 게시물당 6MB 라 몇십 개만 쌓여도 브라우저 용량을 넘긴다 (요청자 결정).
 *
 * ⚠️ 프로필(`profile`)은 담지 않는다. 게시물이 아니라 **계정** 정보라서
 *    옛 게시물을 불러왔다고 프로필까지 과거로 되돌리면 안 된다.
 */
import { getState, setState, lastPersistError } from '../store.js';
import { putImage, getImage, deleteImage, imageKey } from './imagestore.js';

/** 게시물 한 건을 되살리는 데 필요한 상태 키 */
export const POST_KEYS = [
  'productId', 'topic', 'tone', 'channels', 'cardCount',
  'drafts', 'generated', 'variants', 'sources', 'draftKey', 'aiKey', 'outline',
  'concept', 'accent', 'mark', 'cardTheme', 'noteSymbol', 'notePaper', 'noteGrain',
  'card', 'image', 'images',
];

/**
 * 게시물의 신원 = 상품 + 주제.
 * 톤이나 템플릿을 바꿔 가며 다듬는 건 **같은 게시물을 고치는 것**이므로 새 항목을 만들지 않는다.
 */
export const postKeyOf = (s) => `${s.productId}|${String(s.topic || '').trim()}`;

/** 썸네일은 이미지와 같은 IndexedDB 를 쓴다. 항목 id 로 키를 잡아 게시물끼리 섞이지 않게 한다. */
export const thumbKey = (id) => `lib-thumb-${id}`;

const newId = () => `lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** 참조를 끊어서 담는다. 안 그러면 이후 편집이 보관함 항목까지 따라 바뀐다. */
const snapshot = (state) => {
  const out = {};
  for (const k of POST_KEYS) if (state[k] !== undefined) out[k] = state[k];
  return JSON.parse(JSON.stringify(out));
};

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
  const at = before.findIndex((it) => it.postKey === key);
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
    title: String(state.topic).trim(),
    productId: state.productId,
    tone: state.tone,
    concept: state.concept,
    cardCount: state.cardCount,
    channels: [...(state.channels || [])],
    hasThumb,
    state: snapshot(state),
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

  return { ok: true, replaced: at >= 0, item };
}

/**
 * 보관함에서 지운다. 썸네일도 같이 지운다.
 *
 * ⚠️ 카드 원본 이미지는 건드리지 않는다. 그건 상품·템플릿 단위로 공유되는 값이라
 *    (`imageKey(productId, conceptId, i)`) 게시물 하나를 지웠다고 없애면
 *    같은 상품의 다른 게시물에서 이미지가 사라진다.
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
  snap.images = await reconcileImages(snap);
  setState(snap);
  return { ok: true, item };
}

async function reconcileImages(snap) {
  const saved = snap.images && typeof snap.images === 'object' ? snap.images : {};
  const total = Number(snap.cardCount) || 6;
  const out = {};
  for (let i = 0; i < total; i++) {
    const blob = await getImage(imageKey(snap.productId, snap.concept, i)).catch(() => null);
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
