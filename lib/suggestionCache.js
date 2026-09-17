/**
 * Small, browser-only cache for suggestion calls. Suggestions are inexpensive
 * to store but expensive to regenerate, and unlike app state this survives a
 * refresh or a new tab. Values expire so an old set never becomes permanent.
 */
const STORAGE_KEY = "bboggl.suggestion-cache.v1";
const TTL = 24 * 60 * 60 * 1000;
const LIMIT = 80;

const memory = new Map();

export function cacheKey(namespace, value) {
  // A compact deterministic key avoids putting product facts directly into
  // localStorage keys while still invalidating whenever an input changes.
  let hash = 2166136261;
  const source = `${namespace}|${value}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${namespace}:${(hash >>> 0).toString(36)}`;
}

function readAll() {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeAll(entries) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable (private mode/quota). The in-memory cache
    // still prevents duplicate calls during this page visit.
  }
}

export function readSuggestion(key) {
  const now = Date.now();
  const item = memory.get(key) || readAll()[key];
  if (!item || item.expiresAt <= now || !Array.isArray(item.value)) return null;
  memory.set(key, item);
  return item.value;
}

export function writeSuggestion(key, value) {
  if (!Array.isArray(value) || !value.length) return value;
  const item = { value, expiresAt: Date.now() + TTL, savedAt: Date.now() };
  memory.set(key, item);

  const entries = readAll();
  entries[key] = item;
  const kept = Object.entries(entries)
    .filter(([, entry]) => entry?.expiresAt > Date.now())
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, LIMIT);
  writeAll(Object.fromEntries(kept));
  return value;
}

export function clearSuggestion(key) {
  memory.delete(key);
  const entries = readAll();
  if (!(key in entries)) return;
  delete entries[key];
  writeAll(entries);
}
