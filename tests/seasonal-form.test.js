import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENCIES } from "../src/calculator/validation.js";
import { calculateSeasonalProfit } from "../src/calculator/calculateSeasonalProfit.js";
import { MAX_NIGHTLY_PRICE } from "../src/js/ui/limits.js";
import {
  SEASONAL_FIELD_IDS,
  SEASONAL_COMMON_FIELDS,
  MONTHS,
  buildSeasonalInput,
  evaluateSeasonal,
  fieldToInputId,
  applyToAll,
  effectiveYear,
  visibleSeasonalErrors,
} from "../src/js/ui/seasonal-form.js";
import {
  SAMPLES,
  seasonalSample,
  nextSeasonalSampleState,
  nextSampleState,
  nextGroupState,
  groupOfField,
  groupSample,
  sampleNoticeVisible,
  ALL_PRISTINE,
} from "../src/js/ui/samples.js";

// Tam bir ham girdi: sezonluk örnek + ortak alanlar (basit örnekten).
function rawFor(currency, year = 2026) {
  const s = seasonalSample(currency, year);
  const common = {};
  for (const f of SEASONAL_COMMON_FIELDS) common[f] = SAMPLES[currency][f];
  return { ...common, ...s };
}

test("SEASONAL_FIELD_IDS: year, averageStayNights, price-1..12, occ-1..12", () => {
  assert.equal(SEASONAL_FIELD_IDS.length, 26);
  assert.ok(SEASONAL_FIELD_IDS.includes("year"));
  assert.ok(SEASONAL_FIELD_IDS.includes("averageStayNights"));
  for (const n of MONTHS) {
    assert.ok(SEASONAL_FIELD_IDS.includes(`price-${n}`));
    assert.ok(SEASONAL_FIELD_IDS.includes(`occ-${n}`));
  }
});

test("buildSeasonalInput: boş zorunlu alan '' olur, ortak opsiyonel boş 0 olur", () => {
  const { input, ambiguous } = buildSeasonalInput({}, "USD");
  assert.equal(input.currency, "USD");
  assert.equal(input.year, "");
  assert.equal(input.averageStayNights, "");
  assert.equal(input.months.length, 12);
  for (const m of input.months) {
    assert.equal(m.nightlyPrice, "");
    assert.equal(m.occupancyRate, "");
  }
  for (const f of SEASONAL_COMMON_FIELDS) assert.equal(input[f], 0, f);
  assert.deepEqual(ambiguous, []);
});

test("buildSeasonalInput: 12 ay ve sayılar ayrıştırılır", () => {
  const { input } = buildSeasonalInput(rawFor("USD", 2028), "USD");
  assert.equal(input.year, 2028);
  assert.equal(input.averageStayNights, 4);
  assert.equal(input.months.length, 12);
  assert.equal(input.months[0].nightlyPrice, 96);
  assert.equal(input.months[7].occupancyRate, 90);
  assert.equal(input.platformFeeRate, 15);
  assert.equal(input.propertyManagement, 0);
});

test("buildSeasonalInput: belirsiz sayı ambiguous listesine girer (id ile), motor çağrılmaz", () => {
  const raw = rawFor("USD");
  raw.months[2].price = "1.234";
  raw.maintenance = "1,234";
  const { ambiguous } = buildSeasonalInput(raw, "USD");
  assert.deepEqual(ambiguous.sort(), ["maintenance", "price-3"]);
  const out = evaluateSeasonal(raw, "USD");
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors.map((e) => e.code), ["AMBIGUOUS_NUMBER", "AMBIGUOUS_NUMBER"]);
  assert.deepEqual(out.errors.map((e) => e.field).sort(), ["maintenance", "price-3"]);
});

test("evaluateSeasonal: tipik girdi ok:true, yıllık net 12 ayın toplamı", () => {
  const out = evaluateSeasonal(rawFor("USD"), "USD");
  assert.equal(out.ok, true);
  const sum = out.result.months.reduce((s, m) => s + m.netOperatingIncome, 0);
  assert.ok(Math.abs(out.result.annual.netOperatingIncome - sum) < 1e-6);
  assert.equal(out.result.year, 2026);
});

test("evaluateSeasonal: motor hata alanları input id'sine eşlenir", () => {
  const raw = rawFor("USD");
  raw.months[2].price = "-5";
  raw.months[10].occupancy = "150";
  raw.year = "";
  raw.averageStayNights = "0";
  raw.platformFeeRate = "abc";
  const out = evaluateSeasonal(raw, "USD");
  assert.equal(out.ok, false);
  const byField = Object.fromEntries(out.errors.map((e) => [e.field, e.code]));
  assert.equal(byField["price-3"], "NEGATIVE_VALUE");
  assert.equal(byField["occ-11"], "OUT_OF_RANGE");
  assert.equal(byField.year, "REQUIRED");
  assert.equal(byField.averageStayNights, "OUT_OF_RANGE");
  assert.equal(byField.platformFeeRate, "NOT_A_NUMBER");
  for (const e of out.errors) assert.ok(!e.field.startsWith("months."), e.field);
});

test("evaluateSeasonal: REQUIRED (boş aylık alan)", () => {
  const raw = rawFor("EUR");
  raw.months[0].price = "";
  raw.months[11].occupancy = "  ";
  const out = evaluateSeasonal(raw, "EUR");
  assert.equal(out.ok, false);
  assert.deepEqual(
    out.errors.map((e) => [e.field, e.code]).sort(),
    [["occ-12", "REQUIRED"], ["price-1", "REQUIRED"]]
  );
});

test("evaluateSeasonal: aylık gecelik fiyat üst sınırı TOO_LARGE ve motor çağrılmaz", () => {
  const raw = rawFor("TRY");
  raw.months[2].price = String(MAX_NIGHTLY_PRICE + 1);
  const out = evaluateSeasonal(raw, "TRY");
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors, [{ field: "price-3", code: "TOO_LARGE", params: { max: MAX_NIGHTLY_PRICE } }]);
  // sınırın kendisi geçerli
  raw.months[2].price = String(MAX_NIGHTLY_PRICE);
  assert.equal(evaluateSeasonal(raw, "TRY").ok, true);
});

test("evaluateSeasonal: ortak alan üst sınırı (mevcut checkLimits mantığı)", () => {
  const raw = rawFor("USD");
  raw.cleaningCostPerBooking = "100001";
  raw.maintenance = "10000001";
  const out = evaluateSeasonal(raw, "USD");
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors.map((e) => e.field).sort(), ["cleaningCostPerBooking", "maintenance"]);
  assert.ok(out.errors.every((e) => e.code === "TOO_LARGE" && e.params.max > 0));
});

test("evaluateSeasonal: yıl tam sayı olmalı; geçersiz para birimi", () => {
  const raw = rawFor("USD");
  raw.year = "2026.5";
  assert.equal(evaluateSeasonal(raw, "USD").errors[0].code, "NOT_AN_INTEGER");
  assert.equal(evaluateSeasonal(rawFor("USD"), "XXX").errors[0].code, "INVALID_CURRENCY");
});

test("fieldToInputId", () => {
  assert.equal(fieldToInputId("months.3.nightlyPrice"), "price-3");
  assert.equal(fieldToInputId("months.3.occupancyRate"), "occ-3");
  assert.equal(fieldToInputId("months.12.nightlyPrice"), "price-12");
  assert.equal(fieldToInputId("year"), "year");
  assert.equal(fieldToInputId("averageStayNights"), "averageStayNights");
  assert.equal(fieldToInputId("platformFeeRate"), "platformFeeRate");
  assert.equal(fieldToInputId("input"), "input");
  assert.equal(fieldToInputId("months.3"), "months.3");
});

test("visibleSeasonalErrors: yalnızca dokunulmuş alanlar ve genel hatalar", () => {
  const errors = [
    { field: "price-1", code: "REQUIRED" },
    { field: "occ-2", code: "REQUIRED" },
    { field: "maintenance", code: "NEGATIVE_VALUE" },
    { field: "input", code: "RESULT_OUT_OF_RANGE" },
  ];
  const shown = visibleSeasonalErrors(errors, new Set(["price-1", "maintenance"]));
  assert.deepEqual(shown.map((e) => e.field), ["price-1", "maintenance", "input"]);
});

test("effectiveYear: geçerli yıl veya yedek", () => {
  assert.equal(effectiveYear("2028", 2026), 2028);
  assert.equal(effectiveYear("", 2026), 2026);
  assert.equal(effectiveYear("abc", 2026), 2026);
  assert.equal(effectiveYear("1800", 2026), 2026);
  assert.equal(effectiveYear("2027.5", 2026), 2026);
});

test("applyToAll: iki değer 12 aya yazılır, girdi değişmez", () => {
  const raw = { months: seasonalSample("USD", 2026).months };
  const before = JSON.stringify(raw);
  const out = applyToAll(raw, { price: "100", occupancy: "50" });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.applied, { price: true, occupancy: true });
  assert.equal(out.raw.months.length, 12);
  for (const m of out.raw.months) assert.deepEqual(m, { price: "100", occupancy: "50" });
  assert.equal(JSON.stringify(raw), before);
});

test("applyToAll: boş alan uygulanmaz", () => {
  const raw = { months: seasonalSample("USD", 2026).months };
  const out = applyToAll(raw, { price: "", occupancy: "  80 " });
  assert.deepEqual(out.applied, { price: false, occupancy: true });
  assert.deepEqual(out.errors, []);
  out.raw.months.forEach((m, i) => {
    assert.equal(m.price, raw.months[i].price);
    assert.equal(m.occupancy, "80");
  });
  const none = applyToAll(raw, { price: "", occupancy: "" });
  assert.deepEqual(none.applied, { price: false, occupancy: false });
  assert.deepEqual(none.raw.months, raw.months);
});

test("applyToAll: belirsiz/geçersiz sayı hata verir ve uygulanmaz; diğer alan uygulanır", () => {
  const raw = { months: seasonalSample("USD", 2026).months };
  let out = applyToAll(raw, { price: "1.234", occupancy: "60" });
  assert.deepEqual(out.errors, [{ field: "apply-price", code: "AMBIGUOUS_NUMBER" }]);
  assert.deepEqual(out.applied, { price: false, occupancy: true });
  assert.equal(out.raw.months[0].price, raw.months[0].price);

  out = applyToAll(raw, { price: "abc", occupancy: "101" });
  assert.deepEqual(out.errors.map((e) => [e.field, e.code]), [
    ["apply-price", "NOT_A_NUMBER"],
    ["apply-occ", "OUT_OF_RANGE"],
  ]);
  assert.deepEqual(out.raw.months, raw.months);

  out = applyToAll(raw, { price: "-1", occupancy: "-1" });
  assert.deepEqual(out.errors.map((e) => e.code), ["NEGATIVE_VALUE", "OUT_OF_RANGE"]);

  out = applyToAll(raw, { price: String(MAX_NIGHTLY_PRICE + 1) });
  assert.deepEqual(out.errors, [{ field: "apply-price", code: "TOO_LARGE", params: { max: MAX_NIGHTLY_PRICE } }]);
});

test("applyToAll: uygulanan değerle sonuç hesaplanabilir", () => {
  const raw = { ...rawFor("USD"), months: seasonalSample("USD", 2026).months };
  const applied = applyToAll(raw, { price: "100", occupancy: "50" }).raw;
  assert.equal(evaluateSeasonal(applied, "USD").ok, true);
});

test("seasonalSample: her para biriminde 12 ay, tam sayı metin fiyat, motordan ok:true ve kârlı", () => {
  for (const c of CURRENCIES) {
    const s = seasonalSample(c, 2026);
    assert.equal(s.year, "2026");
    assert.equal(s.averageStayNights, "4");
    assert.equal(s.months.length, 12);
    for (const m of s.months) {
      assert.equal(typeof m.price, "string");
      assert.match(m.price, /^\d+$/);
      assert.match(m.occupancy, /^\d+$/);
    }
    const out = evaluateSeasonal(rawFor(c), c);
    assert.equal(out.ok, true, c);
    assert.ok(out.result.annual.netOperatingIncome > 0, `${c} kârlı olmalı`);
    // ham motor da aynı sonucu verir (UI sarmalayıcısı sonucu değiştirmez)
    const { input } = buildSeasonalInput(rawFor(c), c);
    assert.deepEqual(calculateSeasonalProfit(input), out);
  }
});

test("seasonalSample: yıl parametresi, para birimi türevi ve yaz/kış desen", () => {
  assert.equal(seasonalSample("USD", 2028).year, "2028");
  const usd = seasonalSample("USD", 2026);
  assert.equal(usd.months[0].price, "96"); // 120 x 0.8
  assert.equal(usd.months[6].price, "162"); // 120 x 1.35
  assert.equal(usd.months[6].occupancy, "90");
  assert.equal(seasonalSample("TRY", 2026).months[6].price, "4725"); // 3500 x 1.35
  assert.equal(seasonalSample("XXX", 2026).months[0].price, "96"); // bilinmeyen -> USD
  // her çağrıda yeni nesne
  const a = seasonalSample("USD", 2026);
  a.months[0].price = "1";
  assert.equal(seasonalSample("USD", 2026).months[0].price, "96");
});

test("pristine sezonluk: para birimi değişince yeni örneğe geçer", () => {
  const s = nextSeasonalSampleState(
    { seasonalPristine: true },
    { type: "currency", currency: "TRY", year: 2026 }
  );
  assert.equal(s.seasonalPristine, true);
  assert.deepEqual(s.values, seasonalSample("TRY", 2026));
});

test("dirty sezonluk: para birimi değişince girdiler korunur", () => {
  const s = nextSeasonalSampleState(
    { seasonalPristine: false },
    { type: "currency", currency: "EUR", year: 2026 }
  );
  assert.deepEqual(s, { seasonalPristine: false, values: null });
});

test("sezonluk edit pristine'i bitirir; reset örneği geri getirir", () => {
  assert.deepEqual(nextSeasonalSampleState({ seasonalPristine: true }, { type: "edit" }), {
    seasonalPristine: false,
    values: null,
  });
  const r = nextSeasonalSampleState({ seasonalPristine: false }, { type: "reset", currency: "GBP", year: 2027 });
  assert.equal(r.seasonalPristine, true);
  assert.deepEqual(r.values, seasonalSample("GBP", 2027));
});

test("ortak ve sezonluk pristine bağımsızdır", () => {
  // ortak düzenlendi, sezonluk pristine: para birimi -> ortak korunur, sezonluk yeni örnek
  let common = { currency: "USD", pristine: true };
  let seasonal = { seasonalPristine: true };
  common = { ...common, ...nextSampleState(common, { type: "edit" }) };
  const c = nextSampleState(common, { type: "currency", currency: "TRY" });
  const s = nextSeasonalSampleState(seasonal, { type: "currency", currency: "TRY", year: 2026 });
  assert.equal(c.values, null);
  assert.deepEqual(s.values, seasonalSample("TRY", 2026));
  // sezonluk düzenlendi, ortak pristine: tersi
  seasonal = { ...seasonal, ...nextSeasonalSampleState(seasonal, { type: "edit" }) };
  const c2 = nextSampleState({ currency: "USD", pristine: true }, { type: "currency", currency: "EUR" });
  const s2 = nextSeasonalSampleState(seasonal, { type: "currency", currency: "EUR", year: 2026 });
  assert.deepEqual(c2.values, SAMPLES.EUR);
  assert.equal(s2.values, null);
});

// ---- Üç bağımsız grup bayrağı ----

// main.js'teki akışın modeli: değerler grup başına tutulur, fill olan gruba SEÇİLİ para biriminin örneği yazılır.
function startModel(currency) {
  return {
    currency,
    flags: { ...ALL_PRISTINE },
    values: {
      common: groupSample("common", currency),
      simpleOnly: groupSample("simpleOnly", currency),
      seasonal: groupSample("seasonal", currency, 2026),
    },
  };
}
function step(model, action, nextCurrency) {
  const m = { ...model, values: { ...model.values } };
  if (nextCurrency) m.currency = nextCurrency;
  const next = nextGroupState(m.flags, action);
  m.flags = next.flags;
  for (const g of Object.keys(next.fill)) {
    if (next.fill[g]) m.values[g] = groupSample(g, m.currency, 2026);
  }
  return m;
}
function edit(model, field, group) {
  const m = step(model, { type: "edit", field });
  m.values[group] = { ...m.values[group], __edited: true };
  return m;
}
// Bileşik ham girdi: ortak + sezonluk (basit-özgü alanlar sezonluk motora girmez).
const composite = (m) => ({ ...m.values.common, ...m.values.seasonal });

test("groupOfField: alan -> grup eşlemesi", () => {
  for (const f of ["platformFeeRate", "cleaningCostPerBooking", "maintenance", "otherExpenses"]) {
    assert.equal(groupOfField(f), "common", f);
  }
  for (const f of ["nightlyPrice", "availableNights", "occupancyRate", "bookingsPerMonth"]) {
    assert.equal(groupOfField(f), "simpleOnly", f);
  }
  for (const f of ["year", "averageStayNights", "price-1", "occ-12"]) assert.equal(groupOfField(f), "seasonal", f);
  for (const f of ["apply-price", "apply-occ", "currency", "x"]) assert.equal(groupOfField(f), null, f);
});

test("(c) üç bayrak bağımsız: bir alan yalnızca kendi grubunu düşürür", () => {
  const cases = [["nightlyPrice", "simpleOnly"], ["maintenance", "common"], ["occ-4", "seasonal"], ["year", "seasonal"]];
  for (const [field, group] of cases) {
    const { flags, fill } = nextGroupState({ ...ALL_PRISTINE }, { type: "edit", field });
    for (const g of ["common", "simpleOnly", "seasonal"]) assert.equal(flags[g], g !== group, `${field}/${g}`);
    assert.deepEqual(fill, { common: false, simpleOnly: false, seasonal: false });
  }
  // bilinmeyen alan / dil aksiyonu: değişmez
  assert.deepEqual(nextGroupState({ ...ALL_PRISTINE }, { type: "edit", field: "apply-price" }).flags, ALL_PRISTINE);
  assert.deepEqual(nextGroupState({ common: false, simpleOnly: true, seasonal: true }, { type: "language" }).flags, {
    common: false,
    simpleOnly: true,
    seasonal: true,
  });
});

test("(a) basit-özgü alan düzenlenip para birimi değişince ortak alanlar YENİ örneğe geçer", () => {
  let m = startModel("TRY");
  m = edit(m, "nightlyPrice", "simpleOnly");
  m = step(m, { type: "currency" }, "USD");
  assert.deepEqual(m.values.common, groupSample("common", "USD"));
  assert.deepEqual(m.values.seasonal, groupSample("seasonal", "USD", 2026));
  assert.equal(m.values.simpleOnly.__edited, true); // düzenlenen grup korunur
  assert.deepEqual(m.flags, { common: true, simpleOnly: false, seasonal: true });
});

test("(b) ortak alan düzenlenince ortak korunur, diğer gruplar yeni örneğe geçer", () => {
  let m = startModel("TRY");
  m = edit(m, "cleaningCostPerBooking", "common");
  m = step(m, { type: "currency" }, "EUR");
  assert.equal(m.values.common.__edited, true);
  assert.deepEqual(m.values.simpleOnly, groupSample("simpleOnly", "EUR"));
  assert.deepEqual(m.values.seasonal, groupSample("seasonal", "EUR", 2026));
});

test("sezonluk düzenlenince yalnızca sezonluk korunur; reset üçünü seçili para biriminin örneğine döndürür", () => {
  let m = startModel("GBP");
  m = edit(m, "price-3", "seasonal");
  m = step(m, { type: "currency" }, "USD");
  assert.equal(m.values.seasonal.__edited, true);
  assert.deepEqual(m.values.common, groupSample("common", "USD"));
  assert.deepEqual(m.values.simpleOnly, groupSample("simpleOnly", "USD"));
  m = edit(m, "maintenance", "common");
  m = step(m, { type: "reset" });
  assert.deepEqual(m.flags, ALL_PRISTINE);
  assert.deepEqual(m.values, startModel("USD").values);
});

test("groupSample ortak + basit-özgü birleşimi mevcut sample setine eşit", () => {
  for (const c of CURRENCIES) {
    assert.deepEqual({ ...groupSample("common", c), ...groupSample("simpleOnly", c) }, SAMPLES[c]);
  }
});

test("sampleNoticeVisible: basit modda common+simpleOnly, sezonluk modda common+seasonal", () => {
  const f = (common, simpleOnly, seasonal) => ({ common, simpleOnly, seasonal });
  assert.equal(sampleNoticeVisible("simple", f(true, true, false)), true);
  assert.equal(sampleNoticeVisible("simple", f(true, false, true)), false);
  assert.equal(sampleNoticeVisible("simple", f(false, true, true)), false);
  assert.equal(sampleNoticeVisible("seasonal", f(true, false, true)), true);
  assert.equal(sampleNoticeVisible("seasonal", f(true, true, false)), false);
  assert.equal(sampleNoticeVisible("seasonal", f(false, true, true)), false);
});

test("(d) bileşik sonuç: tüm para birimi geçişleri ve karışık dirty kombinasyonlarında ok:true ve yıllık net > 0", () => {
  const combos = [
    [], ["simpleOnly"], ["common"], ["seasonal"], ["simpleOnly", "seasonal"],
  ];
  const fieldOf = { common: "maintenance", simpleOnly: "nightlyPrice", seasonal: "price-1" };
  for (const from of CURRENCIES) {
    for (const to of CURRENCIES) {
      for (const dirty of combos) {
        let m = startModel(from);
        // dirty grup düzenlenmiş sayılır (değerleri from örneği olarak kalır: kullanıcıya aittir)
        for (const g of dirty) m = step(m, { type: "edit", field: fieldOf[g] });
        m = step(m, { type: "currency" }, to);
        // pristine gruplar daima SEÇİLİ para biriminin örneğidir
        for (const g of ["common", "simpleOnly", "seasonal"]) {
          if (!dirty.includes(g)) {
            assert.deepEqual(m.values[g], groupSample(g, to, 2026), `${from}->${to} ${g}`);
          }
        }
        // sezonluk ve ortak ikisi de pristine ise bileşik sonuç kârlı olmalı
        if (!dirty.includes("common") && !dirty.includes("seasonal")) {
          const out = evaluateSeasonal(composite(m), to);
          assert.equal(out.ok, true, `${from}->${to}`);
          assert.ok(out.result.annual.netOperatingIncome > 0, `${from}->${to} net>0`);
        }
      }
    }
  }
  // reset sonrası her para biriminde kârlı
  for (const c of CURRENCIES) {
    const out = evaluateSeasonal(composite(startModel(c)), c);
    assert.equal(out.ok, true, c);
    assert.ok(out.result.annual.netOperatingIncome > 0, c);
  }
});

test("dil değişimi sezonluk girdileri etkilemez (durum geçişi değil; sonuçlar dilden bağımsız)", () => {
  const s = nextSeasonalSampleState({ seasonalPristine: false }, { type: "language", lang: "en" });
  assert.deepEqual(s, { seasonalPristine: false, values: null });
  const p = nextSeasonalSampleState({ seasonalPristine: true }, { type: "language", lang: "tr" });
  assert.deepEqual(p, { seasonalPristine: true, values: null });
  // Değerlendirme yalnızca ham metin + para birimine bağlıdır; dil parametresi yoktur.
  const raw = rawFor("TRY");
  const before = JSON.stringify(raw);
  assert.deepEqual(evaluateSeasonal(raw, "TRY"), evaluateSeasonal(raw, "TRY"));
  assert.equal(JSON.stringify(raw), before);
});
