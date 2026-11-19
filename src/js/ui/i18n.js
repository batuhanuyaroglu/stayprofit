// Çeviri katmanı. Modül seviyesinde DOM'a dokunmaz; DOM işleri yalnızca çağrılınca ve document varsa yapılır.

export const SUPPORTED = Object.freeze(["tr", "en"]);
const FALLBACK = "en";
export const TRANSLATIONS_APPLIED = "stayprofit:translations-applied";

const dicts = {};
let current = FALLBACK;

/** Başlangıç dili: kayıtlı tercih -> tarayıcı dilleri (tr* -> tr) -> en. */
export function detectLang(stored, languages) {
  if (SUPPORTED.includes(stored)) return stored;
  for (const l of languages || []) {
    if (typeof l === "string" && l.toLowerCase().startsWith("tr")) return "tr";
    if (typeof l === "string" && l.toLowerCase().startsWith("en")) return "en";
  }
  return FALLBACK;
}

export function getLang() {
  return current;
}

/** Varsayılan ağ katmanı: fetch hatası, HTTP !ok ve geçersiz JSON hata fırlatır. */
export async function fetchLocale(lang) {
  const url = new URL(`../../locales/${lang}.json`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`locale ${lang}: ${res.status}`);
  const data = await res.json();
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`locale ${lang}: invalid format`);
  }
  return data;
}

async function ensureLoaded(lang, loader) {
  if (dicts[lang]) return true;
  try {
    dicts[lang] = await loader(lang);
    return true;
  } catch {
    return false;
  }
}

/**
 * İstenen dili yükler; olmazsa diğer dile düşer. DOM'a dokunmaz (test edilebilir).
 * @param {string} lang
 * @param {(lang:string)=>Promise<object>} [loader]
 * @returns {Promise<{lang:string|null, usedFallback:boolean, failed:boolean}>}
 */
export async function loadWithFallback(lang, loader = fetchLocale) {
  const want = SUPPORTED.includes(lang) ? lang : FALLBACK;
  if (await ensureLoaded(want, loader)) {
    current = want;
    return { lang: want, usedFallback: false, failed: false };
  }
  const other = SUPPORTED.find((l) => l !== want);
  if (await ensureLoaded(other, loader)) {
    current = other;
    return { lang: other, usedFallback: true, failed: false };
  }
  return { lang: null, usedFallback: false, failed: true };
}

/** Çeviri anahtarı; {param} yer tutucularını doldurur. Bulunamazsa en, o da yoksa anahtarın kendisi. */
export function t(key, params) {
  const raw = dicts[current]?.[key] ?? dicts[FALLBACK]?.[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/** data-i18n, data-i18n-attr="attr:key;attr2:key2" çevirir; title ve <html lang> güncellenir. */
export function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // meta description da bu yolla güncellenir (content:meta.description).
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const idx = pair.indexOf(":");
      if (idx < 1) continue;
      el.setAttribute(pair.slice(0, idx).trim(), t(pair.slice(idx + 1).trim()));
    }
  });
  document.title = t("meta.title");
  document.documentElement.lang = current;
  // Dinamik etiket yazan modüller (örn. tema düğmesi) için bildirim.
  document.dispatchEvent(new CustomEvent(TRANSLATIONS_APPLIED));
}

/**
 * Dili yükler ve uygular. Sonuç: { lang, usedFallback, failed }.
 * failed ise hiçbir çeviri yoktur; çağıran statik hata kutusunu göstermelidir. Asla throw etmez.
 */
export async function setLanguage(lang, loader = fetchLocale) {
  const out = await loadWithFallback(lang, loader);
  if (!out.failed && typeof document !== "undefined") applyTranslations(document);
  return out;
}
