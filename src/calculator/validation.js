// StayProfit giriş doğrulama. Saf fonksiyon, asla throw etmez, sessiz dönüştürme yapmaz.
// Oranlar yüzde cinsindedir (20 = %20). Aylık tutarlar seçilen para biriminde.

export const CURRENCIES = Object.freeze(["TRY", "USD", "EUR", "GBP"]);

export const EXPENSE_FIELDS = Object.freeze([
  "maintenance",
  "electricity",
  "water",
  "internet",
  "insurance",
  "propertyManagement",
  "otherExpenses",
]);

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

function err(field, code, message) {
  return { field, code, message };
}

// Sayı kontrolü; geçerliyse null, değilse hata döner.
function checkNumber(input, field) {
  const v = input[field];
  if (v === undefined || v === null || v === "") {
    return err(field, "REQUIRED", `${field} is required.`);
  }
  if (!isNumber(v)) {
    return err(field, "NOT_A_NUMBER", `${field} must be a finite number.`);
  }
  return null;
}

function checkNonNegative(input, field, errors) {
  const e = checkNumber(input, field);
  if (e) return errors.push(e);
  if (input[field] < 0) {
    errors.push(err(field, "NEGATIVE_VALUE", `${field} must not be negative.`));
  }
}

function checkRange(input, field, min, max, errors) {
  const e = checkNumber(input, field);
  if (e) return errors.push(e);
  if (input[field] < min || input[field] > max) {
    errors.push(err(field, "OUT_OF_RANGE", `${field} must be between ${min} and ${max}.`));
  }
}

/**
 * @param {unknown} input
 * @returns {{ok:true,value:object}|{ok:false,errors:{field:string,code:string,message:string}[]}}
 */
export function validateInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [err("input", "INVALID_INPUT", "Input must be an object.")],
    };
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

  checkNonNegative(input, "nightlyPrice", errors);

  // availableNights: tam sayı 1-31
  const an = checkNumber(input, "availableNights");
  if (an) errors.push(an);
  else if (!Number.isInteger(input.availableNights)) {
    errors.push(err("availableNights", "NOT_AN_INTEGER", "availableNights must be an integer."));
  } else if (input.availableNights < 1 || input.availableNights > 31) {
    errors.push(err("availableNights", "OUT_OF_RANGE", "availableNights must be between 1 and 31."));
  }

  checkRange(input, "occupancyRate", 0, 100, errors);
  checkRange(input, "platformFeeRate", 0, 100, errors);
  checkNonNegative(input, "cleaningCostPerBooking", errors);

  // bookingsPerMonth: tam sayı >= 0
  const bm = checkNumber(input, "bookingsPerMonth");
  let bookingsOk = false;
  if (bm) errors.push(bm);
  else if (!Number.isInteger(input.bookingsPerMonth)) {
    errors.push(err("bookingsPerMonth", "NOT_AN_INTEGER", "bookingsPerMonth must be an integer."));
  } else if (input.bookingsPerMonth < 0) {
    errors.push(err("bookingsPerMonth", "NEGATIVE_VALUE", "bookingsPerMonth must not be negative."));
  } else {
    bookingsOk = true;
  }

  for (const f of EXPENSE_FIELDS) checkNonNegative(input, f, errors);

  // bookingsPerMonth <= bookedNights (ham, yuvarlamasız); bağımlı alanlar geçerliyse
  const occOk =
    isNumber(input.occupancyRate) && input.occupancyRate >= 0 && input.occupancyRate <= 100;
  const anOk =
    Number.isInteger(input.availableNights) &&
    input.availableNights >= 1 &&
    input.availableNights <= 31;
  if (bookingsOk && occOk && anOk) {
    const booked = (input.availableNights * input.occupancyRate) / 100;
    if (input.bookingsPerMonth > booked) {
      errors.push(
        err(
          "bookingsPerMonth",
          "BOOKINGS_EXCEED_BOOKED_NIGHTS",
          "bookingsPerMonth must not exceed booked nights."
        )
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input } };
}
