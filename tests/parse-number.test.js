import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumber, KIND } from "../src/js/ui/parse-number.js";

const ok = (input, expected) => {
  const r = parseNumber(input);
  assert.equal(r.kind, KIND.OK, `${JSON.stringify(input)} OK olmalı`);
  assert.equal(r.value, expected, JSON.stringify(input));
};
const kind = (input, expected) => assert.equal(parseNumber(input).kind, expected, JSON.stringify(input));

test("tek ayraç ondalık (EN/TR)", () => {
  ok("12.5", 12.5);
  ok("12,5", 12.5);
  ok("0.125", 0.125);
  ok("0,125", 0.125);
  ok("1234.567", 1234.567);
  ok(".5", 0.5);
  ok("12.", 12);
  ok("100", 100);
});

test("hem nokta hem virgül: son ayraç ondalık", () => {
  ok("1.234,56", 1234.56);
  ok("1,234.56", 1234.56);
  ok("1.234.567,89", 1234567.89);
  ok("1,234,567.89", 1234567.89);
});

test("belirsiz: tek ayraç + 3 hane", () => {
  kind("1.234", KIND.AMBIGUOUS);
  kind("1,234", KIND.AMBIGUOUS);
  kind("12.345", KIND.AMBIGUOUS);
  kind("123,456", KIND.AMBIGUOUS);
  assert.ok(Number.isNaN(parseNumber("1.234").value));
});

test("tekrarlı ayraç binlik gruplamaysa binlik", () => {
  ok("1.234.567", 1234567);
  ok("1,234,567", 1234567);
  kind("1.2.3", KIND.NAN);
  kind("1.23.456", KIND.NAN);
});

test("boş girdiler", () => {
  for (const v of ["", "   ", null, undefined, " "]) {
    const r = parseNumber(v);
    assert.equal(r.kind, KIND.EMPTY);
    assert.equal(r.value, "");
  }
});

test("harf ve geçersiz biçim NaN", () => {
  for (const v of ["abc", "12a", "1e5", "$12", "-", ".", ",", "1.234,5,6", "1,23.45", "1.234,"]) {
    const r = parseNumber(v);
    assert.equal(r.kind, KIND.NAN, v);
    assert.ok(Number.isNaN(r.value));
  }
});

test("NBSP ve boşluk temizlenir", () => {
  ok("1 234,5", 1234.5);
  ok(" 12 ,5 ", 12.5);
  ok("1 234.5", 1234.5);
});

test("işaretler", () => {
  ok("-12,5", -12.5);
  ok("+12.5", 12.5);
  ok("-0", 0);
  assert.ok(Object.is(parseNumber("-0").value, 0));
  ok("-1.234,56", -1234.56);
});

test("sonsuza taşan değer NaN", () => {
  kind("9".repeat(400), KIND.NAN);
});
