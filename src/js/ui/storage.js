// YALNIZCA dil tercihi saklanır. Mali veri asla saklanmaz.
const KEY = "stayprofit.lang";

export function loadLang() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLang(lang) {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Depolama kapalı olabilir; sessizce geç.
  }
}
