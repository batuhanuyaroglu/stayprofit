import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENCIES } from "../src/calculator/validation.js";
import { evaluate } from "../src/js/ui/form.js";
import { SAMPLES, sampleFor, initialCurrency, nextSampleState } from "../src/js/ui/samples.js";

test("her para biriminin örnek seti motordan ok:true ve kârlı", () => {
  for (const c of CURRENCIES) {
    const out = evaluate(SAMPLES[c], c);
    assert.equal(out.ok, true, c);
    assert.ok(out.result.monthlyNetOperatingIncome > 0, `${c} kârlı olmalı`);
  }
});

test("USD örneği beklenen net değeri verir", () => {
  const out = evaluate(SAMPLES.USD, "USD");
  assert.ok(Math.abs(out.result.monthlyNetOperatingIncome - 1642) < 1e-9);
});

test("sampleFor kopya döner; bilinmeyen para birimi USD", () => {
  const a = sampleFor("TRY");
  a.nightlyPrice = "1";
  assert.equal(SAMPLES.TRY.nightlyPrice, "3500");
  assert.deepEqual(sampleFor("XXX"), SAMPLES.USD);
});

test("ilk açılış para birimi dil ipucundan", () => {
  assert.equal(initialCurrency("tr"), "TRY");
  assert.equal(initialCurrency("en"), "USD");
  assert.equal(initialCurrency(undefined), "USD");
});

test("pristine: para birimi değişince ilgili örnek sete geçilir", () => {
  const s = nextSampleState({ currency: "USD", pristine: true }, { type: "currency", currency: "TRY" });
  assert.equal(s.currency, "TRY");
  assert.equal(s.pristine, true);
  assert.deepEqual(s.values, SAMPLES.TRY);
});

test("dirty: para birimi değişince girdiler korunur (values null)", () => {
  const s = nextSampleState({ currency: "USD", pristine: false }, { type: "currency", currency: "EUR" });
  assert.equal(s.currency, "EUR");
  assert.equal(s.pristine, false);
  assert.equal(s.values, null);
});

test("edit: pristine biter, değerlere dokunulmaz", () => {
  const s = nextSampleState({ currency: "GBP", pristine: true }, { type: "edit" });
  assert.deepEqual(s, { currency: "GBP", pristine: false, values: null });
});

test("reset: seçili para biriminin örneği ve pristine", () => {
  const s = nextSampleState({ currency: "EUR", pristine: false }, { type: "reset" });
  assert.equal(s.currency, "EUR");
  assert.equal(s.pristine, true);
  assert.deepEqual(s.values, SAMPLES.EUR);
});

test("dil değişimi durum geçişi değildir: bilinmeyen aksiyon durumu ve para birimini korur", () => {
  const s = nextSampleState({ currency: "TRY", pristine: false }, { type: "language", lang: "en" });
  assert.deepEqual(s, { currency: "TRY", pristine: false, values: null });
});

test("senaryo: TRY aç, düzenle, USD'ye geç -> girdiler korunur; reset -> USD örneği", () => {
  let s = { currency: "TRY", pristine: true };
  s = { ...s, ...nextSampleState(s, { type: "edit" }) };
  s = { ...s, ...nextSampleState(s, { type: "currency", currency: "USD" }) };
  assert.equal(s.values, null);
  s = { ...s, ...nextSampleState(s, { type: "reset" }) };
  assert.deepEqual(s.values, SAMPLES.USD);
  assert.equal(s.pristine, true);
});
