import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateProfit } from "../src/calculator/calculateProfit.js";
import { validateInput, EXPENSE_FIELDS } from "../src/calculator/validation.js";

const base = () => ({
  currency: "USD",
  nightlyPrice: 100,
  availableNights: 30,
  occupancyRate: 50,
  platformFeeRate: 10,
  cleaningCostPerBooking: 20,
  bookingsPerMonth: 5,
  maintenance: 0,
  electricity: 0,
  water: 0,
  internet: 0,
  insurance: 0,
  propertyManagement: 0,
  otherExpenses: 0,
});

const codes = (r) => r.errors.map((e) => `${e.field}:${e.code}`);

test("normal kârlı senaryo", () => {
  const r = calculateProfit(base());
  assert.equal(r.ok, true);
  assert.equal(r.result.bookedNights, 15);
  assert.equal(r.result.occupancyPercentage, 50);
  assert.equal(r.result.grossRevenue, 1500);
  assert.equal(r.result.platformFee, 150);
  assert.equal(r.result.cleaningExpenses, 100);
  assert.equal(r.result.totalExpenses, 250);
  assert.equal(r.result.monthlyNetOperatingIncome, 1250);
  assert.equal(r.result.annualEstimatedNetOperatingIncome, 15000);
  assert.ok(Math.abs(r.result.profitMargin - (1250 / 1500) * 100) < 1e-9);
  assert.equal(r.result.currency, "USD");
});

test("zararlı senaryo", () => {
  const r = calculateProfit({ ...base(), maintenance: 2000 });
  assert.equal(r.ok, true);
  assert.equal(r.result.monthlyNetOperatingIncome, -750);
  assert.equal(r.result.annualEstimatedNetOperatingIncome, -9000);
  assert.ok(r.result.profitMargin < 0);
});

test("%0 doluluk: gelir 0, marj 0, -0 yok", () => {
  const r = calculateProfit({ ...base(), occupancyRate: 0, bookingsPerMonth: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.result.grossRevenue, 0);
  assert.equal(r.result.profitMargin, 0);
  assert.equal(Object.is(r.result.profitMargin, -0), false);
  assert.equal(r.result.monthlyNetOperatingIncome, 0);
  assert.equal(Object.is(r.result.monthlyNetOperatingIncome, -0), false);
});

test("%100 doluluk", () => {
  const r = calculateProfit({ ...base(), occupancyRate: 100, bookingsPerMonth: 30 });
  assert.equal(r.ok, true);
  assert.equal(r.result.bookedNights, 30);
  assert.equal(r.result.grossRevenue, 3000);
});

test("%0 komisyon", () => {
  const r = calculateProfit({ ...base(), platformFeeRate: 0 });
  assert.equal(r.result.platformFee, 0);
  assert.equal(r.result.totalExpenses, 100);
});

test("sıfır temizlik maliyeti", () => {
  const r = calculateProfit({ ...base(), cleaningCostPerBooking: 0 });
  assert.equal(r.result.cleaningExpenses, 0);
  assert.equal(r.result.totalExpenses, 150);
});

test("tüm gider kalemleri toplanır", () => {
  const r = calculateProfit({
    ...base(),
    maintenance: 1,
    electricity: 2,
    water: 3,
    internet: 4,
    insurance: 5,
    propertyManagement: 6,
    otherExpenses: 7,
  });
  assert.equal(r.result.operatingExpenses, 28);
  assert.equal("otherExpenses" in r.result, false);
  assert.equal(r.result.totalExpenses, 150 + 100 + 28);
});

test("negatif fiyat ve gider reddedilir", () => {
  const r = calculateProfit({ ...base(), nightlyPrice: -1, water: -5, cleaningCostPerBooking: -1 });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), [
    "nightlyPrice:NEGATIVE_VALUE",
    "cleaningCostPerBooking:NEGATIVE_VALUE",
    "water:NEGATIVE_VALUE",
  ]);
});

test("geçersiz para birimi", () => {
  for (const c of ["JPY", "usd", 5]) {
    const r = calculateProfit({ ...base(), currency: c });
    assert.equal(r.ok, false);
    assert.deepEqual(codes(r), ["currency:INVALID_CURRENCY"]);
  }
});

test("rezervasyon sayısı dolu geceyi aşarsa hata", () => {
  const r = calculateProfit({ ...base(), bookingsPerMonth: 16 });
  assert.deepEqual(codes(r), ["bookingsPerMonth:BOOKINGS_EXCEED_BOOKED_NIGHTS"]);
  // ham (yuvarlamasız) karşılaştırma: 30*0.05=1.5 -> 2 rezervasyon reddedilir
  const r2 = calculateProfit({ ...base(), occupancyRate: 5, bookingsPerMonth: 2 });
  assert.deepEqual(codes(r2), ["bookingsPerMonth:BOOKINGS_EXCEED_BOOKED_NIGHTS"]);
  assert.equal(calculateProfit({ ...base(), occupancyRate: 5, bookingsPerMonth: 1 }).ok, true);
});

test("NaN, Infinity, null, boş string, eksik alan", () => {
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: NaN })), ["nightlyPrice:NOT_A_NUMBER"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: Infinity })), ["nightlyPrice:NOT_A_NUMBER"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: -Infinity })), ["nightlyPrice:NOT_A_NUMBER"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: null })), ["nightlyPrice:REQUIRED"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: "" })), ["nightlyPrice:REQUIRED"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), nightlyPrice: "100" })), ["nightlyPrice:NOT_A_NUMBER"]);
  const { insurance, ...missing } = base();
  assert.deepEqual(codes(calculateProfit(missing)), ["insurance:REQUIRED"]);
});

test("girdi nesne değilse INVALID_INPUT", () => {
  for (const x of [null, undefined, 5, "a", [], true]) {
    const r = validateInput(x);
    assert.equal(r.ok, false);
    assert.deepEqual(r.errors.map((e) => [e.field, e.code]), [["input", "INVALID_INPUT"]]);
  }
});

test("availableNights sınırları", () => {
  const run = (n) => calculateProfit({ ...base(), availableNights: n, occupancyRate: 100, bookingsPerMonth: 0 });
  assert.deepEqual(codes(run(0)), ["availableNights:OUT_OF_RANGE"]);
  assert.equal(run(1).ok, true);
  assert.equal(run(31).ok, true);
  assert.deepEqual(codes(run(32)), ["availableNights:OUT_OF_RANGE"]);
  assert.deepEqual(codes(run(1.5)), ["availableNights:NOT_AN_INTEGER"]);
});

test("oran sınırları (doluluk ve komisyon)", () => {
  for (const f of ["occupancyRate", "platformFeeRate"]) {
    const run = (n) => calculateProfit({ ...base(), [f]: n, bookingsPerMonth: 0 });
    assert.equal(run(0).ok, true);
    assert.equal(run(100).ok, true);
    assert.deepEqual(codes(run(-1)), [`${f}:OUT_OF_RANGE`]);
    assert.deepEqual(codes(run(100.1)), [`${f}:OUT_OF_RANGE`]);
  }
});

test("bookingsPerMonth tam sayı ve negatif olmamalı", () => {
  assert.deepEqual(codes(calculateProfit({ ...base(), bookingsPerMonth: 1.5 })), ["bookingsPerMonth:NOT_AN_INTEGER"]);
  assert.deepEqual(codes(calculateProfit({ ...base(), bookingsPerMonth: -1 })), ["bookingsPerMonth:NEGATIVE_VALUE"]);
});

test("grossRevenue=0 iken profitMargin=0 (fiyat 0, giderler var)", () => {
  const r = calculateProfit({ ...base(), nightlyPrice: 0, maintenance: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.result.grossRevenue, 0);
  assert.equal(r.result.profitMargin, 0);
  assert.equal(r.result.monthlyNetOperatingIncome, -150);
  assert.ok(Number.isFinite(r.result.profitMargin));
});

test("çoklu hata birlikte toplanır", () => {
  const r = calculateProfit({
    ...base(),
    currency: "XXX",
    nightlyPrice: NaN,
    availableNights: 40,
    occupancyRate: 101,
    water: -1,
  });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), [
    "currency:INVALID_CURRENCY",
    "nightlyPrice:NOT_A_NUMBER",
    "availableNights:OUT_OF_RANGE",
    "occupancyRate:OUT_OF_RANGE",
    "water:NEGATIVE_VALUE",
  ]);
  for (const e of r.errors) assert.equal(typeof e.message, "string");
});

test("4 para birimi de başarılı", () => {
  for (const currency of ["TRY", "USD", "EUR", "GBP"]) {
    const r = calculateProfit({ ...base(), currency });
    assert.equal(r.ok, true);
    assert.equal(r.result.currency, currency);
  }
});

test("1e308 taşma: RESULT_OUT_OF_RANGE", () => {
  const r = calculateProfit({ ...base(), nightlyPrice: 1e308 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => [e.field, e.code]), [["input", "RESULT_OUT_OF_RANGE"]]);
  const r2 = calculateProfit({ ...base(), maintenance: 1e308, water: 1e308 });
  assert.deepEqual(codes(r2), ["input:RESULT_OUT_OF_RANGE"]);
});

test("EXPENSE_FIELDS dondurulmuş", () => {
  assert.equal(Object.isFrozen(EXPENSE_FIELDS), true);
});

test("girdi nesnesi değiştirilmez", () => {
  const i = Object.freeze(base());
  assert.equal(calculateProfit(i).ok, true);
});
