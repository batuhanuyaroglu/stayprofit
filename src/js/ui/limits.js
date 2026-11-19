// UI üst sınırları (saf). Yalnızca motorun sınırlamadığı alanlar; oranlar, geceler ve rezervasyon sayısı
// motor tarafından zaten denetlenir. Aşılırsa motor çağrılmaz.

import { EXPENSE_FIELDS } from "../../calculator/validation.js";

export const MAX_NIGHTLY_PRICE = 1_000_000;
export const MAX_CLEANING_COST = 100_000;
export const MAX_MONTHLY_EXPENSE = 10_000_000;

export const LIMITS = Object.freeze({
  nightlyPrice: MAX_NIGHTLY_PRICE,
  cleaningCostPerBooking: MAX_CLEANING_COST,
  ...Object.fromEntries(EXPENSE_FIELDS.map((f) => [f, MAX_MONTHLY_EXPENSE])),
});

/**
 * @param {Record<string,unknown>} input motor girdisi (sayılar)
 * @returns {{field:string, code:"TOO_LARGE", params:{max:number}}[]} sınırı aşan alanlar
 */
export function checkLimits(input) {
  const errors = [];
  for (const [field, max] of Object.entries(LIMITS)) {
    const v = input?.[field];
    if (typeof v === "number" && Number.isFinite(v) && v > max) {
      errors.push({ field, code: "TOO_LARGE", params: { max } });
    }
  }
  return errors;
}
