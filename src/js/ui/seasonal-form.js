// Sezonluk form katmanı: SAF mantık (DOM'suz, test edilir). DOM tarafı seasonal-view.js'tedir.
// Ham metin -> motor girdisi -> sonuç/hata. Finansal formül yoktur; hesap calculateSeasonalProfit'te.

import { EXPENSE_FIELDS } from "../../calculator/validation.js";
import { calculateSeasonalProfit } from "../../calculator/calculateSeasonalProfit.js";
import { parseNumber, KIND } from "./parse-number.js";
import { checkLimits, MAX_NIGHTLY_PRICE } from "./limits.js";

export const MONTHS = Object.freeze(Array.from({ length: 12 }, (_, i) => i + 1));

// Basit modla ORTAK alanlar (iki modda aynı değeri paylaşır); boşsa 0.
export const SEASONAL_COMMON_FIELDS = Object.freeze([
  "platformFeeRate",
  "cleaningCostPerBooking",
  ...EXPENSE_FIELDS,
]);

// Sezonluk girdi kimlikleri (input id): yıl, ortalama konaklama, aylık fiyat ve doluluk.
export const SEASONAL_FIELD_IDS = Object.freeze([
  "year",
  "averageStayNights",
  ...MONTHS.map((n) => `price-${n}`),
  ...MONTHS.map((n) => `occ-${n}`),
]);

export const APPLY_PRICE_ID = "apply-price";
export const APPLY_OCCUPANCY_ID = "apply-occ";

/** Motor alan adı -> input id. "months.3.nightlyPrice" -> "price-3"; diğerleri aynen. */
export function fieldToInputId(field) {
  const m = /^months\.(\d+)\.(nightlyPrice|occupancyRate)$/.exec(String(field));
  if (!m) return field;
  return `${m[2] === "nightlyPrice" ? "price" : "occ"}-${m[1]}`;
}

/** Gün sayısı gösterimi için geçerli yıl: metin 1900-2200 tam sayıysa o, değilse yedek. */
export function effectiveYear(text, fallback) {
  const p = parseNumber(text);
  if (p.kind === KIND.OK && Number.isInteger(p.value) && p.value >= 1900 && p.value <= 2200) {
    return p.value;
  }
  return fallback;
}

function readNumber(text, id, required, ambiguous) {
  const p = parseNumber(text);
  if (p.kind === KIND.AMBIGUOUS) {
    ambiguous.push(id);
    return NaN;
  }
  if (p.kind === KIND.EMPTY) return required ? "" : 0; // zorunlu boş -> motor REQUIRED
  return p.value; // OK -> sayı, NAN -> NaN (motor NOT_A_NUMBER)
}

/**
 * Ham metinleri motor girdisine çevirir.
 * @param {{year?:string, averageStayNights?:string, months?:{price?:string, occupancy?:string}[]} & Record<string,string>} raw
 * @param {string} currency
 * @returns {{input:object, ambiguous:string[]}} ambiguous: input id listesi
 */
export function buildSeasonalInput(raw, currency) {
  const ambiguous = [];
  const input = { currency };
  input.year = readNumber(raw?.year, "year", true, ambiguous);
  input.averageStayNights = readNumber(raw?.averageStayNights, "averageStayNights", true, ambiguous);
  for (const f of SEASONAL_COMMON_FIELDS) input[f] = readNumber(raw?.[f], f, false, ambiguous);
  input.months = MONTHS.map((n) => ({
    nightlyPrice: readNumber(raw?.months?.[n - 1]?.price, `price-${n}`, true, ambiguous),
    occupancyRate: readNumber(raw?.months?.[n - 1]?.occupancy, `occ-${n}`, true, ambiguous),
  }));
  return { input, ambiguous };
}

function monthLimitErrors(input) {
  const errors = [];
  input.months.forEach((m, i) => {
    const v = m.nightlyPrice;
    if (typeof v === "number" && Number.isFinite(v) && v > MAX_NIGHTLY_PRICE) {
      errors.push({ field: `months.${i + 1}.nightlyPrice`, code: "TOO_LARGE", params: { max: MAX_NIGHTLY_PRICE } });
    }
  });
  return errors;
}

/**
 * Ham metin -> sonuç veya hata listesi (alanlar input id'sine eşlenmiş). Belirsiz sayı veya
 * UI üst sınırı aşımı varsa motor ÇAĞRILMAZ.
 * @returns {{ok:true,result:object}|{ok:false,errors:{field:string,code:string,params?:object}[]}}
 */
export function evaluateSeasonal(raw, currency) {
  const { input, ambiguous } = buildSeasonalInput(raw, currency);
  const pre = [
    ...ambiguous.map((field) => ({ field, code: "AMBIGUOUS_NUMBER" })),
    ...[...checkLimits(input), ...monthLimitErrors(input)].map((e) => ({
      ...e,
      field: fieldToInputId(e.field),
    })),
  ];
  if (pre.length > 0) return { ok: false, errors: pre };
  const out = calculateSeasonalProfit(input);
  if (out.ok) return out;
  return {
    ok: false,
    errors: out.errors.map(({ field, code }) => ({ field: fieldToInputId(field), code })),
  };
}

const KNOWN_FIELDS = new Set([...SEASONAL_FIELD_IDS, ...SEASONAL_COMMON_FIELDS]);

/** Gösterilecek hatalar: yalnızca dokunulmuş alanlar ile alan dışı genel hatalar. */
export function visibleSeasonalErrors(errors, touched) {
  return errors.filter((e) => !KNOWN_FIELDS.has(e.field) || touched.has(e.field));
}

export const isSeasonalFieldId = (id) => SEASONAL_FIELD_IDS.includes(id);

function checkApplyValue(field, text, validate) {
  const p = parseNumber(text);
  if (p.kind === KIND.EMPTY) return { skip: true };
  if (p.kind === KIND.AMBIGUOUS) return { error: { field, code: "AMBIGUOUS_NUMBER" } };
  if (p.kind === KIND.NAN) return { error: { field, code: "NOT_A_NUMBER" } };
  const e = validate(p.value);
  if (e) return { error: { field, ...e } };
  return { value: String(text).trim() };
}

const validatePrice = (v) => {
  if (v < 0) return { code: "NEGATIVE_VALUE" };
  if (v > MAX_NIGHTLY_PRICE) return { code: "TOO_LARGE", params: { max: MAX_NIGHTLY_PRICE } };
  return null;
};
const validateOccupancy = (v) => (v < 0 || v > 100 ? { code: "OUT_OF_RANGE" } : null);

/**
 * "Tüm aylara uygula": boş alan uygulanmaz; geçersiz/belirsiz alan hata verir ve uygulanmaz.
 * Girdiyi değiştirmez. Uygulanan değer kullanıcının yazdığı metindir.
 * @param {{months?:{price:string,occupancy:string}[]}} raw
 * @param {{price?:string, occupancy?:string}} values
 * @returns {{raw:object, applied:{price:boolean,occupancy:boolean}, errors:{field:string,code:string,params?:object}[]}}
 */
export function applyToAll(raw, values) {
  const price = checkApplyValue(APPLY_PRICE_ID, values?.price, validatePrice);
  const occ = checkApplyValue(APPLY_OCCUPANCY_ID, values?.occupancy, validateOccupancy);
  const errors = [price.error, occ.error].filter(Boolean);
  const applied = { price: price.value !== undefined, occupancy: occ.value !== undefined };
  const months = MONTHS.map((n) => {
    const cur = raw?.months?.[n - 1];
    return {
      price: applied.price ? price.value : cur?.price ?? "",
      occupancy: applied.occupancy ? occ.value : cur?.occupancy ?? "",
    };
  });
  return { raw: { ...raw, months }, applied, errors };
}
