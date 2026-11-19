import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_VALUES,
  FIELD_NAMES,
  buildEngineInput,
  evaluate,
  visibleErrors,
} from "../src/js/ui/form.js";

const minimal = { nightlyPrice: "100", availableNights: "30", occupancyRate: "50" };

test("örnek veri başarılı hesaplanır", () => {
  const out = evaluate(SAMPLE_VALUES, "USD");
  assert.equal(out.ok, true);
  // 30 * %65 = 19.5 gece; gelir 2340; komisyon 351; temizlik 210; gider 137 -> net 1642
  assert.ok(Math.abs(out.result.grossRevenue - 2340) < 1e-9);
  assert.ok(Math.abs(out.result.monthlyNetOperatingIncome - 1642) < 1e-9);
});

test("isteğe bağlı boş alanlar 0 olur", () => {
  const { input, ambiguous } = buildEngineInput(minimal, "USD");
  assert.deepEqual(ambiguous, []);
  for (const f of FIELD_NAMES) {
    if (f in minimal) continue;
    assert.equal(input[f], 0, f);
  }
  assert.equal(evaluate(minimal, "USD").ok, true);
});

test("zorunlu boş alan motora '' gider -> REQUIRED", () => {
  const { input } = buildEngineInput({ ...minimal, nightlyPrice: "" }, "USD");
  assert.equal(input.nightlyPrice, "");
  const out = evaluate({ ...minimal, nightlyPrice: "  " }, "USD");
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.field === "nightlyPrice" && e.code === "REQUIRED"));
});

test("TR ve EN biçimli girdiler", () => {
  const a = evaluate({ ...minimal, nightlyPrice: "1.234,5" }, "TRY");
  const b = evaluate({ ...minimal, nightlyPrice: "1,234.5" }, "TRY");
  assert.equal(a.ok, true);
  assert.equal(a.result.grossRevenue, b.result.grossRevenue);
});

test("belirsiz sayı: motor çağrılmaz, AMBIGUOUS_NUMBER", () => {
  const out = evaluate({ ...minimal, nightlyPrice: "1.234", water: "1,234" }, "USD");
  assert.equal(out.ok, false);
  assert.deepEqual(
    out.errors.map((e) => [e.field, e.code]),
    [
      ["nightlyPrice", "AMBIGUOUS_NUMBER"],
      ["water", "AMBIGUOUS_NUMBER"],
    ]
  );
});

test("harf içeren girdi -> NOT_A_NUMBER", () => {
  const out = evaluate({ ...minimal, platformFeeRate: "abc" }, "USD");
  assert.ok(out.errors.some((e) => e.field === "platformFeeRate" && e.code === "NOT_A_NUMBER"));
});

test("negatif girdi -> NEGATIVE_VALUE", () => {
  const out = evaluate({ ...minimal, nightlyPrice: "-5" }, "USD");
  assert.ok(out.errors.some((e) => e.field === "nightlyPrice" && e.code === "NEGATIVE_VALUE"));
});

test("rezervasyon dolu geceyi aşarsa max parametresi", () => {
  const out = evaluate({ ...minimal, bookingsPerMonth: "20" }, "USD");
  const e = out.errors.find((x) => x.code === "BOOKINGS_EXCEED_BOOKED_NIGHTS");
  assert.ok(e);
  assert.equal(e.params.max, 15);
});

test("geçersiz para birimi motor hatası", () => {
  const out = evaluate(minimal, "XXX");
  assert.ok(out.errors.some((e) => e.field === "currency" && e.code === "INVALID_CURRENCY"));
});

test("visibleErrors: yalnızca dokunulmuş alanlar, bağımlılar ve genel hatalar", () => {
  const errors = [
    { field: "nightlyPrice", code: "REQUIRED" },
    { field: "bookingsPerMonth", code: "BOOKINGS_EXCEED_BOOKED_NIGHTS" },
    { field: "input", code: "RESULT_OUT_OF_RANGE" },
  ];
  assert.deepEqual(visibleErrors(errors, new Set()).map((e) => e.field), ["input"]);
  assert.deepEqual(
    visibleErrors(errors, new Set(["nightlyPrice"])).map((e) => e.field),
    ["nightlyPrice", "input"]
  );
  assert.ok(visibleErrors(errors, new Set(["availableNights"])).some((e) => e.field === "bookingsPerMonth"));
});
