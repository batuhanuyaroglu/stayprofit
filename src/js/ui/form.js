// Form katmanı. Üst kısım SAF (ham metin -> motor girdisi, test edilir);
// alt kısım DOM yardımcılarıdır ve yalnızca çağrılınca DOM'a dokunur.

import { calculateProfit } from "../../calculator/calculateProfit.js";
import { EXPENSE_FIELDS } from "../../calculator/validation.js";
import { parseNumber, KIND } from "./parse-number.js";
import { SAMPLES } from "./samples.js";
import { checkLimits } from "./limits.js";

// Zorunlu alanlar: boşsa motora "" gönderilir -> motor REQUIRED döner.
export const REQUIRED_FIELDS = Object.freeze(["nightlyPrice", "availableNights", "occupancyRate"]);
// İsteğe bağlı alanlar: boşsa 0 kabul edilir (arayüzde "calc.optionalHint" ile belirtilir).
export const OPTIONAL_FIELDS = Object.freeze([
  "platformFeeRate",
  "cleaningCostPerBooking",
  "bookingsPerMonth",
  ...EXPENSE_FIELDS,
]);
export const FIELD_NAMES = Object.freeze([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
export const ADVANCED_FIELDS = Object.freeze(["propertyManagement", "otherExpenses"]);

// Bu alanın hatası, listedeki alanlardan biri değişince de gösterilebilir (çapraz doğrulama).
export const DEPENDENTS = Object.freeze({
  bookingsPerMonth: ["availableNights", "occupancyRate"],
});

// Açılışta ve "Sıfırla" ile yüklenen ÖRNEK değerler (kullanıcının yazacağı biçimde metin).
// Para birimine göre setler samples.js'te; SAMPLE_VALUES geriye uyumluluk için USD setidir.
export const SAMPLE_VALUES = SAMPLES.USD;

/**
 * Ham metinleri motor girdisine çevirir.
 * @param {Record<string,string>} raw alan adı -> ham metin
 * @param {string} currency
 * @returns {{input:object, ambiguous:string[]}}
 */
export function buildEngineInput(raw, currency) {
  const input = { currency };
  const ambiguous = [];
  for (const name of FIELD_NAMES) {
    const parsed = parseNumber(raw?.[name]);
    if (parsed.kind === KIND.AMBIGUOUS) {
      ambiguous.push(name);
      input[name] = NaN;
    } else if (parsed.kind === KIND.EMPTY) {
      input[name] = REQUIRED_FIELDS.includes(name) ? "" : 0;
    } else {
      input[name] = parsed.value; // OK -> sayı, NAN -> NaN (motor NOT_A_NUMBER döner)
    }
  }
  return { input, ambiguous };
}

/**
 * Ham metin -> sonuç veya hata listesi. Belirsiz sayı varsa motor ÇAĞRILMAZ.
 * Hata: { field, code, params? } (message kullanılmaz; i18n errors.<code>).
 * @returns {{ok:true,result:object}|{ok:false,errors:{field:string,code:string,params?:object}[]}}
 */
export function evaluate(raw, currency) {
  const { input, ambiguous } = buildEngineInput(raw, currency);
  // Belirsiz sayı veya UI üst sınırı aşımı varsa motor ÇAĞRILMAZ.
  const pre = [
    ...ambiguous.map((field) => ({ field, code: "AMBIGUOUS_NUMBER" })),
    ...checkLimits(input),
  ];
  if (pre.length > 0) return { ok: false, errors: pre };
  const out = calculateProfit(input);
  if (out.ok) return out;
  const errors = out.errors.map(({ field, code }) => {
    const e = { field, code };
    if (code === "BOOKINGS_EXCEED_BOOKED_NIGHTS") {
      // Yalnızca mesaj parametresi: dolu gece = müsait gece * doluluk / 100.
      e.params = { max: (input.availableNights * input.occupancyRate) / 100 };
    }
    return e;
  });
  return { ok: false, errors };
}

/** Gösterilecek hatalar: dokunulmuş alanlar (ve bağımlıları) ile alan dışı genel hatalar. */
export function visibleErrors(errors, touched) {
  return errors.filter((e) => {
    if (!FIELD_NAMES.includes(e.field)) return true;
    if (touched.has(e.field)) return true;
    return (DEPENDENTS[e.field] || []).some((d) => touched.has(d));
  });
}

// ---- DOM yardımcıları ----

export function readRaw(form) {
  const raw = {};
  for (const name of FIELD_NAMES) raw[name] = form.elements[name]?.value ?? "";
  return raw;
}

export function fillValues(form, values) {
  for (const name of FIELD_NAMES) {
    if (form.elements[name]) form.elements[name].value = values[name] ?? "";
  }
}

export function fillCurrencySelect(select, currencies, labelFor, selected) {
  select.replaceChildren();
  for (const code of currencies) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = labelFor(code);
    select.append(opt);
  }
  select.value = selected;
}

export function setCurrencyUnits(root, currency) {
  root.querySelectorAll('[data-unit="currency"]').forEach((el) => {
    el.textContent = currency;
  });
}

/** Alan hatasını gösterir/temizler (aria-invalid + aria-describedby). */
export function setFieldError(form, name, message) {
  const input = form.elements[name];
  const errEl = document.getElementById(`${name}-error`);
  if (!input || !errEl) return;
  const base = `${name}-hint`;
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", `${base} ${name}-error`);
    errEl.textContent = message;
    errEl.hidden = false;
  } else {
    input.removeAttribute("aria-invalid");
    input.setAttribute("aria-describedby", base);
    errEl.textContent = "";
    errEl.hidden = true;
  }
}
