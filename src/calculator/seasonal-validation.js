// StayProfit mevsimsel girdi doğrulaması. Saf fonksiyon, asla throw etmez, girdiyi değiştirmez.
// Oranlar yüzde cinsindedir (20 = %20). Tutarlar seçilen para biriminde.

import {
  CURRENCIES,
  EXPENSE_FIELDS,
  err,
  checkNumber,
  checkNonNegative,
  checkRange,
} from "./validation.js";

// Yardımcılar alan adına göre girdi okur; "months.N.alan" gibi yol adları için tek anahtarlı sarmalayıcı kullanılır.
const wrap = (path, value) => ({ [path]: value });

/**
 * @param {unknown} input
 * @returns {{ok:true,value:object}|{ok:false,errors:{field:string,code:string,message:string}[]}}
 */
export function validateSeasonalInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [err("input", "INVALID_INPUT", "Input must be an object.")] };
  }

  const errors = [];

  // currency
  const c = input.currency;
  if (c === undefined || c === null || c === "") {
    errors.push(err("currency", "REQUIRED", "currency is required."));
  } else if (typeof c !== "string" || !CURRENCIES.includes(c)) {
    errors.push(
      err("currency", "INVALID_CURRENCY", `currency must be one of ${CURRENCIES.join(", ")}.`)
    );
  }

  // year: tam sayı 1900-2200
  const y = checkNumber(input, "year");
  if (y) errors.push(y);
  else if (!Number.isInteger(input.year)) {
    errors.push(err("year", "NOT_AN_INTEGER", "year must be an integer."));
  } else if (input.year < 1900 || input.year > 2200) {
    errors.push(err("year", "OUT_OF_RANGE", "year must be between 1900 and 2200."));
  }

  // averageStayNights: 1-365 (kesirli olabilir)
  checkRange(input, "averageStayNights", 1, 365, errors);
  checkRange(input, "platformFeeRate", 0, 100, errors);
  checkNonNegative(input, "cleaningCostPerBooking", errors);
  for (const f of EXPENSE_FIELDS) checkNonNegative(input, f, errors);

  // months: tam 12 elemanlı dizi
  const ms = input.months;
  if (!Array.isArray(ms) || ms.length !== 12) {
    errors.push(err("months", "INVALID_INPUT", "months must be an array of exactly 12 items."));
  } else {
    ms.forEach((m, i) => {
      const n = i + 1;
      if (m === null || typeof m !== "object" || Array.isArray(m)) {
        errors.push(err(`months.${n}`, "INVALID_INPUT", `months.${n} must be an object.`));
        return;
      }
      const pf = `months.${n}.nightlyPrice`;
      checkNonNegative(wrap(pf, m.nightlyPrice), pf, errors);
      const of = `months.${n}.occupancyRate`;
      checkRange(wrap(of, m.occupancyRate), of, 0, 100, errors);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...input, months: input.months.map((m) => ({ ...m })) },
  };
}
