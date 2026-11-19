import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localeFor,
  formatCurrency,
  formatPercent,
  formatNumber,
  profitStatus,
} from "../src/js/ui/format.js";

const digits = (s) => s.replace(/\D/g, "");

test("locale eşlemesi", () => {
  assert.equal(localeFor("tr"), "tr-TR");
  assert.equal(localeFor("en"), "en-US");
  assert.equal(localeFor("xx"), "en-US");
});

test("para biçimi dile göre", () => {
  assert.equal(formatCurrency(1234.5, "USD", "en"), "$1,234.50");
  const tr = formatCurrency(1234.5, "TRY", "tr");
  assert.match(tr, /1\.234,50/);
  assert.ok(tr.includes("₺"));
});

test("negatif tutar eksi işaretli, sıfıra yuvarlanan değerde eksi yok", () => {
  assert.match(formatCurrency(-1642, "USD", "en"), /^-\$1,642\.00$|^-\s?\$1,642\.00$/);
  assert.equal(formatCurrency(-0.001, "USD", "en"), "$0.00");
  assert.equal(formatCurrency(-0, "USD", "en"), "$0.00");
});

test("geçersiz değer null", () => {
  assert.equal(formatCurrency(NaN, "USD", "en"), null);
  assert.equal(formatCurrency(Infinity, "USD", "en"), null);
  assert.equal(formatCurrency("12", "USD", "en"), null);
  assert.equal(formatPercent(undefined, "en"), null);
  assert.equal(formatNumber(NaN, "en"), null);
});

test("yüzde: değer zaten yüzde, /100 yok", () => {
  assert.equal(digits(formatPercent(65, "en")), "65");
  assert.ok(formatPercent(65, "en").includes("%"));
  assert.ok(formatPercent(65, "tr").includes("%"));
  assert.match(formatPercent(12.5, "en"), /12\.5/);
  assert.match(formatPercent(12.5, "tr"), /12,5/);
  assert.match(formatPercent(-8.25, "en"), /^-/);
});

test("formatNumber", () => {
  assert.equal(formatNumber(19.5, "en"), "19.5");
  assert.equal(formatNumber(19.5, "tr"), "19,5");
});

test("profitStatus", () => {
  assert.equal(profitStatus(10), "profit");
  assert.equal(profitStatus(-10), "loss");
  assert.equal(profitStatus(0), "even");
  assert.equal(profitStatus(0.001), "even");
  assert.equal(profitStatus(NaN), null);
});
