import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSeasonalProfit,
  daysInMonth,
  isLeapYear,
} from "../src/calculator/calculateSeasonalProfit.js";
import { calculateProfit } from "../src/calculator/calculateProfit.js";
import { validateSeasonalInput } from "../src/calculator/seasonal-validation.js";

const base = () => ({
  currency: "USD",
  year: 2025,
  averageStayNights: 4,
  platformFeeRate: 10,
  cleaningCostPerBooking: 20,
  maintenance: 100,
  electricity: 0,
  water: 0,
  internet: 0,
  insurance: 0,
  propertyManagement: 0,
  otherExpenses: 0,
  months: Array.from({ length: 12 }, () => ({ nightlyPrice: 100, occupancyRate: 50 })),
});

const withMonths = (fn) => {
  const i = base();
  fn(i.months);
  return i;
};
const codes = (r) => r.errors.map((e) => `${e.field}:${e.code}`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test("isLeapYear ve daysInMonth", () => {
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.equal(daysInMonth(2025, 4), 30);
  assert.equal(daysInMonth(2025, 12), 31);
});

test("12 ayın gün toplamı 365/366", () => {
  const total = (y) => Array.from({ length: 12 }, (_, i) => daysInMonth(y, i + 1)).reduce((a, b) => a + b);
  assert.equal(total(2025), 365);
  assert.equal(total(2024), 366);
  assert.equal(total(1900), 365);
  assert.equal(total(2000), 366);
});

test("tipik kârlı senaryo (elle hesaplı)", () => {
  const r = calculateSeasonalProfit(base());
  assert.equal(r.ok, true);
  assert.equal(r.result.currency, "USD");
  assert.equal(r.result.year, 2025);
  assert.equal(r.result.months.length, 12);
  const jan = r.result.months[0];
  assert.equal(jan.month, 1);
  assert.equal(jan.days, 31);
  assert.equal(jan.bookedNights, 15.5);
  assert.equal(jan.occupancyPercentage, 50);
  assert.equal(jan.grossRevenue, 1550);
  assert.equal(jan.platformFee, 155);
  assert.equal(jan.bookings, 3.875);
  assert.equal(jan.cleaningExpenses, 77.5);
  assert.equal(jan.operatingExpenses, 100);
  assert.equal(jan.totalExpenses, 332.5);
  assert.equal(jan.netOperatingIncome, 1217.5);
  close(jan.profitMargin, (1217.5 / 1550) * 100);
  const a = r.result.annual;
  assert.equal(a.days, 365);
  assert.equal(a.bookedNights, 182.5);
  assert.equal(a.occupancyPercentage, 50);
  assert.equal(a.bookings, 45.625);
  assert.equal(a.grossRevenue, 18250);
  assert.equal(a.platformFee, 1825);
  assert.equal(a.cleaningExpenses, 912.5);
  assert.equal(a.operatingExpenses, 1200);
  assert.equal(a.totalExpenses, 3937.5);
  assert.equal(a.netOperatingIncome, 14312.5);
  close(a.profitMargin, (14312.5 / 18250) * 100);
});

test("mevsimsel değişen fiyat/doluluk", () => {
  const input = withMonths((m) => {
    m[6] = { nightlyPrice: 300, occupancyRate: 90 };
    m[0] = { nightlyPrice: 50, occupancyRate: 10 };
  });
  const r = calculateSeasonalProfit(input);
  assert.equal(r.ok, true);
  const jul = r.result.months[6];
  close(jul.bookedNights, 27.9);
  close(jul.grossRevenue, 300 * 27.9);
  close(jul.occupancyPercentage, 90);
  const jan = r.result.months[0];
  close(jan.grossRevenue, 50 * 3.1);
  assert.ok(jul.netOperatingIncome > jan.netOperatingIncome);
});

test("yıllık toplamlar aylık toplamlara eşit; annualNet != tek ay x 12", () => {
  const input = withMonths((m) => {
    m[6] = { nightlyPrice: 300, occupancyRate: 90 };
    m[1] = { nightlyPrice: 40, occupancyRate: 20 };
  });
  const { months, annual } = calculateSeasonalProfit(input).result;
  for (const f of [
    "days", "bookedNights", "bookings", "grossRevenue", "platformFee",
    "cleaningExpenses", "operatingExpenses", "totalExpenses", "netOperatingIncome",
  ]) {
    close(annual[f], months.reduce((s, m) => s + m[f], 0));
  }
  close(
    annual.occupancyPercentage,
    (months.reduce((s, m) => s + m.bookedNights, 0) / months.reduce((s, m) => s + m.days, 0)) * 100
  );
  assert.notEqual(annual.netOperatingIncome, months[0].netOperatingIncome * 12);
  assert.notEqual(annual.netOperatingIncome, months[6].netOperatingIncome * 12);
});

test("tutarlılık: calculateProfit ile 31 günlük ay", () => {
  // 31 gün, %100 doluluk, 31 gece/konaklama -> bookings 1 (tam sayı)
  const s = { ...base(), averageStayNights: 31 };
  s.months = s.months.map(() => ({ nightlyPrice: 120, occupancyRate: 100 }));
  const jan = calculateSeasonalProfit(s).result.months[0];
  const p = calculateProfit({
    currency: "USD",
    nightlyPrice: 120,
    availableNights: 31,
    occupancyRate: 100,
    platformFeeRate: 10,
    cleaningCostPerBooking: 20,
    bookingsPerMonth: 1,
    maintenance: 100,
    electricity: 0, water: 0, internet: 0, insurance: 0, propertyManagement: 0, otherExpenses: 0,
  }).result;
  assert.equal(jan.grossRevenue, p.grossRevenue);
  assert.equal(jan.platformFee, p.platformFee);
  assert.equal(jan.cleaningExpenses, p.cleaningExpenses);
  assert.equal(jan.operatingExpenses, p.operatingExpenses);
  assert.equal(jan.netOperatingIncome, p.monthlyNetOperatingIncome);
});

test("%0 doluluk: gelir 0, marj 0, -0 yok", () => {
  const r = calculateSeasonalProfit(withMonths((m) => m.forEach((x) => (x.occupancyRate = 0))));
  assert.equal(r.ok, true);
  for (const m of [...r.result.months, r.result.annual]) {
    assert.equal(m.grossRevenue, 0);
    assert.equal(m.profitMargin, 0);
    assert.equal(Object.is(m.profitMargin, -0), false);
    assert.equal(Object.is(m.bookedNights, -0), false);
  }
  assert.equal(r.result.months[0].netOperatingIncome, -100);
  assert.equal(r.result.annual.netOperatingIncome, -1200);
});

test("%100 doluluk", () => {
  const r = calculateSeasonalProfit(withMonths((m) => m.forEach((x) => (x.occupancyRate = 100))));
  assert.equal(r.result.months[1].bookedNights, 28);
  assert.equal(r.result.annual.bookedNights, 365);
  assert.equal(r.result.annual.occupancyPercentage, 100);
  assert.equal(r.result.annual.grossRevenue, 36500);
});

test("zararlı ay ve yıllık toplamda doğru işaret", () => {
  const loss = withMonths((m) => (m[0] = { nightlyPrice: 10, occupancyRate: 10 }));
  loss.maintenance = 0;
  loss.cleaningCostPerBooking = 50;
  const r = calculateSeasonalProfit(loss).result;
  assert.ok(r.months[0].netOperatingIncome < 0);
  assert.ok(r.months[0].profitMargin < 0);
  assert.ok(r.months[1].netOperatingIncome > 0);
  assert.ok(r.annual.netOperatingIncome > 0);

  const allLoss = { ...base(), maintenance: 5000 };
  const a = calculateSeasonalProfit(allLoss).result.annual;
  assert.ok(a.netOperatingIncome < 0);
  assert.ok(a.profitMargin < 0);
});

test("%0 komisyon ve sıfır temizlik", () => {
  const r = calculateSeasonalProfit({ ...base(), platformFeeRate: 0, cleaningCostPerBooking: 0 });
  assert.equal(r.result.annual.platformFee, 0);
  assert.equal(r.result.annual.cleaningExpenses, 0);
  assert.equal(r.result.months[0].totalExpenses, 100);
});

test("averageStayNights 1 -> bookings = bookedNights", () => {
  const r = calculateSeasonalProfit({ ...base(), averageStayNights: 1 });
  for (const m of r.result.months) assert.equal(m.bookings, m.bookedNights);
});

test("kesirli bookings yuvarlanmaz (30 gece %50, 4 gece -> 3.75)", () => {
  const r = calculateSeasonalProfit(base());
  assert.equal(r.result.months[3].days, 30);
  assert.equal(r.result.months[3].bookings, 3.75);
});

test("giderler her aya aynı uygulanır (7 kalem toplamı)", () => {
  const r = calculateSeasonalProfit({
    ...base(), maintenance: 1, electricity: 2, water: 3, internet: 4,
    insurance: 5, propertyManagement: 6, otherExpenses: 7,
  });
  for (const m of r.result.months) assert.equal(m.operatingExpenses, 28);
  assert.equal(r.result.annual.operatingExpenses, 336);
});

test("doğrulama: months yapısı", () => {
  for (const bad of [
    { ...base(), months: base().months.slice(0, 11) },
    { ...base(), months: [...base().months, { nightlyPrice: 1, occupancyRate: 1 }] },
    { ...base(), months: "x" },
    { ...base(), months: undefined },
  ]) {
    const r = calculateSeasonalProfit(bad);
    assert.equal(r.ok, false);
    assert.deepEqual(codes(r), ["months:INVALID_INPUT"]);
  }
  const r = calculateSeasonalProfit(withMonths((m) => { m[2] = 5; m[4] = null; }));
  assert.deepEqual(codes(r), ["months.3:INVALID_INPUT", "months.5:INVALID_INPUT"]);
  assert.equal(calculateSeasonalProfit(null).errors[0].field, "input");
  assert.equal(calculateSeasonalProfit([]).errors[0].code, "INVALID_INPUT");
});

test("doğrulama: months.N.nightlyPrice", () => {
  const cases = [
    [-1, "NEGATIVE_VALUE"],
    [NaN, "NOT_A_NUMBER"],
    [Infinity, "NOT_A_NUMBER"],
    ["", "REQUIRED"],
    [null, "REQUIRED"],
  ];
  for (const [v, code] of cases) {
    const r = calculateSeasonalProfit(withMonths((m) => (m[6].nightlyPrice = v)));
    assert.deepEqual(codes(r), [`months.7.nightlyPrice:${code}`]);
  }
});

test("doğrulama: months.N.occupancyRate", () => {
  for (const v of [101, -1]) {
    const r = calculateSeasonalProfit(withMonths((m) => (m[11].occupancyRate = v)));
    assert.deepEqual(codes(r), ["months.12.occupancyRate:OUT_OF_RANGE"]);
  }
});

test("doğrulama: averageStayNights", () => {
  for (const v of [0.99, 366]) {
    assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), averageStayNights: v })), [
      "averageStayNights:OUT_OF_RANGE",
    ]);
  }
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), averageStayNights: NaN })), [
    "averageStayNights:NOT_A_NUMBER",
  ]);
  assert.equal(calculateSeasonalProfit({ ...base(), averageStayNights: 1.5 }).ok, true);
});

test("doğrulama: year", () => {
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), year: 1899 })), ["year:OUT_OF_RANGE"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), year: 2201 })), ["year:OUT_OF_RANGE"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), year: 2024.5 })), ["year:NOT_AN_INTEGER"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), year: "2024" })), ["year:NOT_A_NUMBER"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), year: undefined })), ["year:REQUIRED"]);
});

test("doğrulama: currency, negatif gider, komisyon, temizlik", () => {
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), currency: "JPY" })), ["currency:INVALID_CURRENCY"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), currency: "" })), ["currency:REQUIRED"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), water: -1 })), ["water:NEGATIVE_VALUE"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), platformFeeRate: 101 })), ["platformFeeRate:OUT_OF_RANGE"]);
  assert.deepEqual(codes(calculateSeasonalProfit({ ...base(), cleaningCostPerBooking: -5 })), [
    "cleaningCostPerBooking:NEGATIVE_VALUE",
  ]);
});

test("doğrulama: çoklu hata birlikte toplanır", () => {
  const input = withMonths((m) => {
    m[0].nightlyPrice = -1;
    m[11].occupancyRate = 200;
  });
  input.currency = "XXX";
  input.year = 1800;
  input.maintenance = -1;
  const r = calculateSeasonalProfit(input);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), [
    "currency:INVALID_CURRENCY",
    "year:OUT_OF_RANGE",
    "maintenance:NEGATIVE_VALUE",
    "months.1.nightlyPrice:NEGATIVE_VALUE",
    "months.12.occupancyRate:OUT_OF_RANGE",
  ]);
});

test("1e308 taşma -> RESULT_OUT_OF_RANGE", () => {
  const r = calculateSeasonalProfit(withMonths((m) => (m[0].nightlyPrice = 1e308)));
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => [e.field, e.code]), [["input", "RESULT_OUT_OF_RANGE"]]);
});

test("girdi nesnesi değişmez", () => {
  const input = base();
  const snap = JSON.stringify(input);
  const frozen = Object.freeze({ ...input, months: Object.freeze(input.months.map((m) => Object.freeze({ ...m }))) });
  assert.equal(calculateSeasonalProfit(frozen).ok, true);
  calculateSeasonalProfit(input);
  validateSeasonalInput(input);
  assert.equal(JSON.stringify(input), snap);
});

test("4 para birimi başarılı", () => {
  for (const currency of ["TRY", "USD", "EUR", "GBP"]) {
    const r = calculateSeasonalProfit({ ...base(), currency });
    assert.equal(r.ok, true);
    assert.equal(r.result.currency, currency);
  }
});
