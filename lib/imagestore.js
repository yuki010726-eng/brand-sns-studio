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

/** 상품·컨셉·카드번호로 키를 만든다 — 컨셉을 바꾸면 이미지도 따로 관리된다 */
export const imageKey = (productId, conceptId, index) => `${productId}-${conceptId}-${index}`;

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
