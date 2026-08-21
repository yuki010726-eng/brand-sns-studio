/**
 * 카드 이미지 저장소 (IndexedDB)
 *
 * localStorage 는 5MB 안팎이라 1024px PNG 6장이 들어가지 않는다.
 * 이미지 Blob 은 IndexedDB 에, 나머지 상태는 기존 store.js(localStorage)에 둔다.
 */

const DB = 'bboggl-sns-studio';
const STORE = 'card-images';
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/** @param {string} key 예: 'kbsn-photo-0' */
export const putImage = (key, blob) => tx('readwrite', (s) => s.put(blob, key));
export const getImage = (key) => tx('readonly', (s) => s.get(key));
export const deleteImage = (key) => tx('readwrite', (s) => s.delete(key));
export const clearImages = () => tx('readwrite', (s) => s.clear());

/**
 * 상품·컨셉·카드번호로 키를 만든다 — 컨셉을 바꾸면 이미지도 따로 관리된다.
 *
 * ⚠️ **`postId` 가 앞에 붙는다** (2026-08-21, 요청자 지적).
 *    예전 키는 `상품-템플릿-번호` 라 **게시물이 달라도 같은 키**였다. 그래서 같은 상품으로
 *    새 게시물을 만들면 4단계에 **지난 게시물의 이미지가 그대로 떠 있었다** —
 *    `resetFlow()` 가 `state.images` 를 비워도 소용없다. IndexedDB 의 Blob 은 그대로 있고
 *    화면이 키로 다시 읽어 오기 때문이다.
 *
 * ⚠️ **`postId` 가 비어 있으면 옛 키를 그대로 쓴다.** 이 값이 생기기 전에 만든 이미지가
 *    안 보이게 되면 안 된다 — 지금 하던 작업이 통째로 빈 채로 보인다.
 * ⚠️ 게시물을 새로 시작하면 옛 Blob 은 IndexedDB 에 **남는다**(보관함에서 그 게시물을 다시
 *    불러오면 필요하다). 지우는 규칙은 아직 없다 — 용량이 문제가 되면 그때 만든다.
 */
export const imageKey = (productId, conceptId, index, postId = '') =>
  (postId ? `${postId}-${productId}-${conceptId}-${index}` : `${productId}-${conceptId}-${index}`);

/** 생성한 objectURL 을 모아뒀다가 화면을 떠날 때 한 번에 정리한다 */
const urls = new Set();

export function objectUrl(blob) {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return url;
}

export function revokeAll() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
}
