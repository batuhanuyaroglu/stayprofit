// Giriş noktası: durum, olaylar, canlı hesaplama.

import { CURRENCIES } from "../../calculator/validation.js";
import { detectLang, setLanguage, getLang, t, TRANSLATIONS_APPLIED } from "./i18n.js";
import { initialCurrency, groupSample, nextGroupState, sampleNoticeVisible } from "./samples.js";
import { formatNumber } from "./format.js";
import { loadLang, saveLang } from "./storage.js";
import {
  ADVANCED_FIELDS,
  FIELD_NAMES,
  evaluate,
  visibleErrors,
  readRaw,
  fillCurrencySelect,
  setCurrencyUnits,
  setFieldError,
} from "./form.js";
import {
  APPLY_PRICE_ID,
  APPLY_OCCUPANCY_ID,
  MONTHS,
  SEASONAL_COMMON_FIELDS,
  SEASONAL_FIELD_IDS,
  applyToAll,
  evaluateSeasonal,
  isSeasonalFieldId,
  visibleSeasonalErrors,
} from "./seasonal-form.js";
import {
  buildMonthRows,
  currentYear,
  fillSeasonalMonths,
  fillSeasonalValues,
  readSeasonalRaw,
  refreshMonthLabels,
  setInputError,
} from "./seasonal-view.js";
import { renderResults } from "./render.js";
import { renderSeasonalResults } from "./render-seasonal.js";
import { initKeyboardBar } from "./keyboard-bar.js";
import { initTheme } from "./theme.js";

const form = document.getElementById("calc-form");
const currencySelect = document.getElementById("currency");
const resetButton = document.getElementById("reset-button");
const sampleNotice = document.getElementById("sample-notice");
const sampleNoticeSeasonal = document.getElementById("sample-notice-seasonal");
const advanced = document.getElementById("advanced-details");
const advancedBadge = document.getElementById("advanced-badge");
const langButtons = document.querySelectorAll("[data-lang]");
const modeButtons = document.querySelectorAll("[data-mode]");
const monthRows = document.getElementById("month-rows");
const yearInput = document.getElementById("year");
const applyButton = document.getElementById("apply-button");
const applyStatus = document.getElementById("apply-status");
const applyPrice = document.getElementById(APPLY_PRICE_ID);
const applyOcc = document.getElementById(APPLY_OCCUPANCY_ID);
const breakdownDetails = document.getElementById("breakdown-details");

// Varsayılan yıl burada hesaplanır; saf fonksiyonlara parametre olarak geçer.
const DEFAULT_YEAR = new Date().getFullYear();

// Tüm durum yalnızca bellektedir (localStorage yalnızca dil ve tema için kullanılır).
const state = {
  mode: "simple", // "simple" | "seasonal"
  currency: "USD",
  // Üç bağımsız pristine bayrağı (true = kullanıcı düzenlemedi, örnek veri var).
  flags: { common: true, simpleOnly: true, seasonal: true },
  touched: new Set(), // alan adları (basit/ortak) ve sezonluk input id'leri
};

function errorMessage(e) {
  const params = e.params ? { max: formatNumber(e.params.max, getLang()) } : undefined;
  return t(`errors.${e.code}`, params);
}

function updateSimple(raw) {
  const ev = evaluate(raw, state.currency);
  const errors = ev.ok ? [] : ev.errors;
  const shown = visibleErrors(errors, state.touched);

  for (const name of FIELD_NAMES) {
    const e = shown.find((x) => x.field === name);
    setFieldError(form, name, e ? errorMessage(e) : null);
  }

  const advancedHasError = shown.some((e) => ADVANCED_FIELDS.includes(e.field));
  advancedBadge.hidden = advanced.open || !advancedHasError;

  const generalMessages = shown.filter((e) => !FIELD_NAMES.includes(e.field)).map(errorMessage);

  renderResults({
    result: ev.ok ? ev.result : null,
    lang: getLang(),
    currency: state.currency,
    hasErrors: errors.length > 0,
    generalMessages,
  });
}

function updateSeasonal(raw) {
  const ev = evaluateSeasonal({ ...raw, ...readSeasonalRaw() }, state.currency);
  const errors = ev.ok ? [] : ev.errors;
  const shown = visibleSeasonalErrors(errors, state.touched);
  const messageFor = (field) => {
    const e = shown.find((x) => x.field === field);
    return e ? errorMessage(e) : null;
  };

  for (const id of SEASONAL_FIELD_IDS) setInputError(id, messageFor(id));
  for (const name of SEASONAL_COMMON_FIELDS) setFieldError(form, name, messageFor(name));

  const advancedHasError = shown.some((e) => ADVANCED_FIELDS.includes(e.field));
  advancedBadge.hidden = advanced.open || !advancedHasError;

  const known = (f) => SEASONAL_FIELD_IDS.includes(f) || SEASONAL_COMMON_FIELDS.includes(f);
  const generalMessages = shown.filter((e) => !known(e.field)).map(errorMessage);

  renderSeasonalResults({
    result: ev.ok ? ev.result : null,
    lang: getLang(),
    currency: state.currency,
    hasErrors: errors.length > 0,
    generalMessages,
  });
}

function update() {
  const raw = readRaw(form);
  if (state.mode === "seasonal") updateSeasonal(raw);
  else updateSimple(raw);
}

function refreshCurrencyOptions() {
  fillCurrencySelect(currencySelect, CURRENCIES, (c) => t(`currency.${c}`), state.currency);
  setCurrencyUnits(document, state.currency);
}

function refreshLangButtons() {
  langButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
}

function refreshMonths() {
  refreshMonthLabels(monthRows, currentYear(yearInput, DEFAULT_YEAR));
}

// Yükleme hatası göstergeleri. Metinler (yedek dil sözlüğünden) t() ile gelir.
function showLoadFailure() {
  document.getElementById("load-error").hidden = false;
  document.querySelectorAll("[data-app-content]").forEach((el) => {
    el.hidden = true;
  });
  document.getElementById("load-banner").hidden = true;
}

function showFallbackBanner(show) {
  const banner = document.getElementById("load-banner");
  banner.hidden = !show;
  if (show) {
    document.getElementById("load-banner-title").textContent = t("errors.loadFailed");
    document.getElementById("load-banner-hint").textContent = t("errors.loadFailedHint");
  }
}

/** Dili uygular; false dönerse hiçbir çeviri yoktur (hata kutusu gösterildi). Dil değişimi para birimini değiştirmez. */
async function applyLanguage(lang) {
  const out = await setLanguage(lang);
  if (out.failed) {
    showLoadFailure();
    return false;
  }
  showFallbackBanner(out.usedFallback);
  return true;
}

async function changeLanguage(lang) {
  if (!(await applyLanguage(lang))) return;
  saveLang(lang); // kullanıcının seçtiği dil; yedek dil devreye girse bile tercih korunur
  refreshLangButtons();
  refreshCurrencyOptions();
  update();
}

/** Örnek bildirimi: basit modda common+simpleOnly, sezonluk modda common+seasonal pristine ise görünür. */
function refreshNotice() {
  const visible = sampleNoticeVisible(state.mode, state.flags);
  sampleNotice.hidden = !(state.mode === "simple" && visible);
  sampleNoticeSeasonal.hidden = !(state.mode === "seasonal" && visible);
}

/** Üç bağımsız grup geçişini uygular: fill olan gruba SEÇİLİ para biriminin örneği yazılır. */
function applyGroupState(next) {
  state.flags = next.flags;
  if (next.fill.common) fillPartial(groupSample("common", state.currency));
  if (next.fill.simpleOnly) fillPartial(groupSample("simpleOnly", state.currency));
  if (next.fill.seasonal) fillSeasonalValues(groupSample("seasonal", state.currency, DEFAULT_YEAR));
  refreshMonths();
  refreshNotice();
}

// Yalnızca verilen alanları yazar (diğer grupların girdilerine dokunmaz).
function fillPartial(values) {
  for (const [name, value] of Object.entries(values)) {
    if (form.elements[name]) form.elements[name].value = value;
  }
}

function clearApplyAll() {
  applyPrice.value = "";
  applyOcc.value = "";
  setInputError(APPLY_PRICE_ID, null);
  setInputError(APPLY_OCCUPANCY_ID, null);
  applyStatus.textContent = "";
}

function resetForm() {
  // Üç grup da seçili para biriminin örneğine döner.
  applyGroupState(nextGroupState(state.flags, { type: "reset" }));
  state.touched.clear();
  clearApplyAll();
  update();
}

function setMode(mode) {
  state.mode = mode === "seasonal" ? "seasonal" : "simple";
  modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
  // Diğer moda ait alanlar yalnızca gizlenir; değerleri korunur.
  document.querySelectorAll("[data-mode-only]").forEach((el) => {
    el.hidden = el.dataset.modeOnly !== state.mode;
  });
  refreshNotice();
  update();
}

function onApplyAll() {
  const out = applyToAll(
    { months: readSeasonalRaw().months },
    { price: applyPrice.value, occupancy: applyOcc.value }
  );
  for (const id of [APPLY_PRICE_ID, APPLY_OCCUPANCY_ID]) {
    const e = out.errors.find((x) => x.field === id);
    setInputError(id, e ? errorMessage(e) : null);
  }
  applyStatus.textContent = "";
  if (out.applied.price || out.applied.occupancy) {
    fillSeasonalMonths(out.raw.months);
    for (const n of MONTHS) {
      if (out.applied.price) state.touched.add(`price-${n}`);
      if (out.applied.occupancy) state.touched.add(`occ-${n}`);
    }
    applyGroupState(nextGroupState(state.flags, { type: "edit", field: "price-1" }));
    // Aynı metin tekrar duyurulsun diye bölge önce boşaltılır, sonra yazılır.
    setTimeout(() => {
      applyStatus.textContent = t("seasonal.applyAll.done");
    }, 50);
  }
  update();
}

function bindEvents() {
  form.addEventListener("input", (ev) => {
    const name = ev.target?.name;
    const id = ev.target?.id;
    if (FIELD_NAMES.includes(name)) {
      state.touched.add(name);
      applyGroupState(nextGroupState(state.flags, { type: "edit", field: name }));
    } else if (isSeasonalFieldId(id)) {
      state.touched.add(id);
      applyGroupState(nextGroupState(state.flags, { type: "edit", field: id }));
    } else if (id === APPLY_PRICE_ID || id === APPLY_OCCUPANCY_ID) {
      setInputError(id, null); // yeniden yazınca eski uygula hatası temizlenir
      return;
    }
    if (id === "year") refreshMonths();
    update();
  });
  form.addEventListener("focusout", (ev) => {
    const name = ev.target?.name;
    const id = ev.target?.id;
    const key = FIELD_NAMES.includes(name) ? name : isSeasonalFieldId(id) ? id : null;
    if (key && !state.touched.has(key)) {
      state.touched.add(key);
      update();
    }
  });
  form.addEventListener("submit", (ev) => ev.preventDefault());
  advanced.addEventListener("toggle", update);
  currencySelect.addEventListener("change", () => {
    state.currency = currencySelect.value;
    applyGroupState(nextGroupState(state.flags, { type: "currency" }));
    setCurrencyUnits(document, state.currency);
    update();
  });
  resetButton.addEventListener("click", resetForm);
  applyButton.addEventListener("click", onApplyAll);
  modeButtons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  langButtons.forEach((b) =>
    b.addEventListener("click", () => {
      changeLanguage(b.dataset.lang).catch(showLoadFailure);
    })
  );
  // Dil değişince ay adları ve giriş etiketleri yenilenir; girdi değerleri etkilenmez.
  document.addEventListener(TRANSLATIONS_APPLIED, refreshMonths);
}

async function init() {
  const lang = detectLang(loadLang(), navigator.languages);
  if (!(await applyLanguage(lang))) return;
  // İlk açılışta para birimi yalnızca dil ipucundan: tr -> TRY, diğer -> USD. Sonra dil değişse de sabit kalır.
  state.currency = initialCurrency(getLang());
  buildMonthRows(monthRows);
  refreshLangButtons();
  refreshCurrencyOptions();
  applyGroupState(nextGroupState(state.flags, { type: "reset" }));
  // Dar ekranda döküm kapalı başlar (12 kart uzundur); geniş ekranda açık.
  breakdownDetails.open = window.matchMedia("(min-width: 700px)").matches;
  bindEvents();
  setMode("simple");
}

initKeyboardBar();
initTheme();
init().catch(showLoadFailure);
