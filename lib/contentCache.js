/** Shared, browser-only cache for proposal-derived content by product and topic. */
const KEY = "bboggl.content-cache.v1";
const LIMIT = 12;

export const contentCacheKey = (productId, topic) =>
  `${String(productId || "").trim()}|${String(topic || "").trim().replace(/\s+/g, " ").toLowerCase()}`;

function readAll() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || "{}"); return value && typeof value === "object" ? value : {}; }
  catch { return {}; }
}
export function readContentCache(productId, topic) {
  if (typeof window === "undefined") return null;
  return readAll()[contentCacheKey(productId, topic)] || null;
}
export function writeContentCache(productId, topic, value) {
  if (typeof window === "undefined" || !productId || !String(topic).trim()) return;
  try {
    const all = readAll(); all[contentCacheKey(productId, topic)] = { ...value, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(all).sort((a, b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0)).slice(0, LIMIT))));
  } catch { /* Cache failure must not block generation. */ }
}
