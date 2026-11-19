// Giriş noktası: durum, olaylar, canlı hesaplama.

import { CURRENCIES } from "../../calculator/validation.js";
import { detectLang, setLanguage, getLang, t } from "./i18n.js";
import { initialCurrency, sampleFor, nextSampleState } from "./samples.js";
import { formatNumber } from "./format.js";
import { loadLang, saveLang } from "./storage.js";
import {
  ADVANCED_FIELDS,
  FIELD_NAMES,
  evaluate,
  visibleErrors,
  readRaw,
  fillValues,
  fillCurrencySelect,
  setCurrencyUnits,
  setFieldError,
} from "./form.js";
import { renderResults } from "./render.js";

const form = document.getElementById("calc-form");
const currencySelect = document.getElementById("currency");
const resetButton = document.getElementById("reset-button");
const sampleNotice = document.getElementById("sample-notice");
const advanced = document.getElementById("advanced-details");
const advancedBadge = document.getElementById("advanced-badge");
const langButtons = document.querySelectorAll("[data-lang]");

const state = {
  currency: "USD",
  pristine: true, // kullanıcı hiçbir alanı düzenlemedi; yalnızca örnek veri var
  touched: new Set(),
};

function errorMessage(e) {
  const params = e.params ? { max: formatNumber(e.params.max, getLang()) } : undefined;
  return t(`errors.${e.code}`, params);
}

function update() {
  const raw = readRaw(form);
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

function refreshCurrencyOptions() {
  fillCurrencySelect(currencySelect, CURRENCIES, (c) => t(`currency.${c}`), state.currency);
  setCurrencyUnits(document, state.currency);
}

function refreshLangButtons() {
  langButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
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

function applySample(next) {
  state.currency = next.currency;
  state.pristine = next.pristine;
  if (next.values) fillValues(form, next.values);
  sampleNotice.hidden = !state.pristine;
}

function resetForm() {
  applySample(nextSampleState(state, { type: "reset" }));
  state.touched.clear();
  update();
}

function bindEvents() {
  form.addEventListener("input", (ev) => {
    const name = ev.target?.name;
    if (FIELD_NAMES.includes(name)) {
      state.touched.add(name);
      applySample(nextSampleState(state, { type: "edit" }));
    }
    update();
  });
  form.addEventListener("focusout", (ev) => {
    const name = ev.target?.name;
    if (FIELD_NAMES.includes(name) && !state.touched.has(name)) {
      state.touched.add(name);
      update();
    }
  });
  form.addEventListener("submit", (ev) => ev.preventDefault());
  advanced.addEventListener("toggle", update);
  currencySelect.addEventListener("change", () => {
    applySample(nextSampleState(state, { type: "currency", currency: currencySelect.value }));
    setCurrencyUnits(document, state.currency);
    update();
  });
  resetButton.addEventListener("click", resetForm);
  langButtons.forEach((b) =>
    b.addEventListener("click", () => {
      changeLanguage(b.dataset.lang).catch(showLoadFailure);
    })
  );
}

async function init() {
  const lang = detectLang(loadLang(), navigator.languages);
  if (!(await applyLanguage(lang))) return;
  // İlk açılışta para birimi yalnızca dil ipucundan: tr -> TRY, diğer -> USD. Sonra dil değişse de sabit kalır.
  state.currency = initialCurrency(getLang());
  refreshLangButtons();
  refreshCurrencyOptions();
  applySample({ currency: state.currency, pristine: true, values: sampleFor(state.currency) });
  bindEvents();
  update();
}

init().catch(showLoadFailure);
