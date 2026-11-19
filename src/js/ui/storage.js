// YALNIZCA dil tercihi saklanır. Mali veri asla saklanmaz.
const KEY = "stayprofit.lang";

export function loadLang() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Tema tercihi: yalnızca "light" | "dark" saklanır. Depolama enjekte edilebilir (test için).
const THEME_KEY = "stayprofit.theme";
const THEME_VALUES = ["light", "dark"];

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Geçerli kayıtlı tema ya da null (yok, geçersiz veya depolama hatası). */
export function loadTheme(storage = defaultStorage()) {
  try {
    const v = storage?.getItem(THEME_KEY);
    return THEME_VALUES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Yalnızca geçerli temayı yazar; başarıyı döndürür, asla throw etmez. */
export function saveTheme(theme, storage = defaultStorage()) {
  if (!THEME_VALUES.includes(theme)) return false;
  try {
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function saveLang(lang) {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Depolama kapalı olabilir; sessizce geç.
  }
}
