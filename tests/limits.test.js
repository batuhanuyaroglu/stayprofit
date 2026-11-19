import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENCIES } from "../src/calculator/validation.js";
import { evaluate } from "../src/js/ui/form.js";
import { SAMPLES } from "../src/js/ui/samples.js";
import { checkLimits, LIMITS } from "../src/js/ui/limits.js";

const base = { nightlyPrice: "100", availableNights: "30", occupancyRate: "50" };

test("sınırın altında ve tam sınırda hata yok", () => {
  for (const [field, max] of Object.entries(LIMITS)) {
    assert.deepEqual(checkLimits({ [field]: max - 1 }), [], `${field} altında`);
    assert.deepEqual(checkLimits({ [field]: max }), [], `${field} tam sınır`);
  }
});

test("sınır aşılınca TOO_LARGE ve max parametresi", () => {
  for (const [field, max] of Object.entries(LIMITS)) {
    assert.deepEqual(checkLimits({ [field]: max + 1 }), [
      { field, code: "TOO_LARGE", params: { max } },
    ]);
  }
});

test("belirlenen sınır değerleri", () => {
  assert.equal(LIMITS.nightlyPrice, 1_000_000);
  assert.equal(LIMITS.cleaningCostPerBooking, 100_000);
  assert.equal(LIMITS.maintenance, 10_000_000);
  assert.equal(LIMITS.otherExpenses, 10_000_000);
});

test("NaN, boş ve sayı olmayan değerler sınır hatası üretmez", () => {
  assert.deepEqual(checkLimits({ nightlyPrice: NaN, water: "", maintenance: 0 }), []);
  assert.deepEqual(checkLimits(undefined), []);
});

test("evaluate: aşım motor çağrılmadan TOO_LARGE döner", () => {
  const out = evaluate({ ...base, nightlyPrice: "1000001", water: "10000001" }, "USD");
  assert.equal(out.ok, false);
  assert.deepEqual(
    out.errors.map((e) => [e.field, e.code, e.params.max]),
    [
      ["nightlyPrice", "TOO_LARGE", 1_000_000],
      ["water", "TOO_LARGE", 10_000_000],
    ]
  );
});

test("örnek setler engellenmez", () => {
  for (const c of CURRENCIES) assert.equal(evaluate(SAMPLES[c], c).ok, true, c);
});

test("gerçekçi yüksek senaryolar engellenmez", () => {
  const out = evaluate(
    { ...base, nightlyPrice: "50000", maintenance: "500000", otherExpenses: "500000" },
    "TRY"
  );
  assert.equal(out.ok, true);
  assert.equal(evaluate({ ...base, nightlyPrice: "1000000", cleaningCostPerBooking: "100000" }, "TRY").ok, true);
});
