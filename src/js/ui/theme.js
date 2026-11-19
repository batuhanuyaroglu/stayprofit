// Tema (açık/koyu). Saf kısımlar DOM'suz; DOM yalnızca applyTheme/initTheme çağrılınca kullanılır.
// Tema değişimi dili, para birimini, girdileri ve sonuçları etkilemez.

import { t, TRANSLATIONS_APPLIED } from "./i18n.js";
import { loadTheme, saveTheme } from "./storage.js";

export const THEMES = Object.freeze(["light", "dark"]);

// <meta name="theme-color"> CSS değişkeni okuyamaz; değerler --color-surface ile eşleşir (tokens.css).
export const THEME_COLORS = Object.freeze({ light: "#ffffff", dark: "#121c21" });

const MEDIA = "(prefers-color-scheme: dark)";

/** Geçerli kayıtlı tercih önce gelir; yoksa/geçersizse sistem tercihi. */
export function resolveTheme({ stored, prefersDark } = {}) {
  if (THEMES.includes(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(current) {
  return current === "dark" ? "light" : "dark";
}

/** html[data-theme] ve meta theme-color yazar. Geçersiz temada false döner. */
export function applyTheme(theme, doc = document) {
  if (!THEMES.includes(theme)) return false;
  doc.documentElement.setAttribute("data-theme", theme);
  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    doc.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLORS[theme]);
  return true;
}

/** Buton etiketi eylemi söyler: koyuyken "açığa geç", açıkken "koyuya geç". */
function refreshLabel(button, theme) {
  const label = theme === "dark" ? t("theme.toggle.toLight") : t("theme.toggle.toDark");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

export function initTheme(doc = document, win = window) {
  const button = doc.getElementById("theme-toggle");
  const mq = typeof win.matchMedia === "function" ? win.matchMedia(MEDIA) : null;
  const stored = loadTheme();
  let manual = stored !== null; // kullanıcı seçtiyse sistem değişimi izlenmez
  let current = resolveTheme({ stored, prefersDark: Boolean(mq?.matches) });

  const render = () => {
    applyTheme(current, doc);
    if (button) refreshLabel(button, current);
  };
  // İlk yazımda etiket yok: çeviriler henüz yüklenmedi; TRANSLATIONS_APPLIED olayında yazılır.
  applyTheme(current, doc);

  if (button) {
    button.addEventListener("click", () => {
      current = nextTheme(current);
      manual = true;
      saveTheme(current);
      render();
    });
    // Dil değişince etiket yeniden yazılır.
    doc.addEventListener(TRANSLATIONS_APPLIED, () => refreshLabel(button, current));
  }

  if (mq) {
    const onChange = (ev) => {
      if (manual) return;
      current = ev.matches ? "dark" : "light";
      render();
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else if (typeof mq.addListener === "function") mq.addListener(onChange);
  }
}
