import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CURRENCIES } from "../src/calculator/validation.js";
import { FIELD_NAMES } from "../src/js/ui/form.js";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const load = (lang) => JSON.parse(readFileSync(path.join(src, "locales", `${lang}.json`), "utf8"));
const tr = load("tr");
const en = load("en");

test("tr ve en aynı anahtar kümesine sahip", () => {
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
});

test("boş değer yok", () => {
  for (const [lang, dict] of [["tr", tr], ["en", en]]) {
    for (const [k, v] of Object.entries(dict)) {
      assert.equal(typeof v, "string", `${lang}:${k}`);
      assert.ok(v.trim().length > 0, `${lang}:${k} boş`);
    }
  }
});

function usedKeys() {
  const keys = new Set();
  const html = readFileSync(path.join(src, "index.html"), "utf8");
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(";")) keys.add(pair.slice(pair.indexOf(":") + 1).trim());
  }
  const uiDir = path.join(src, "js", "ui");
  for (const f of readdirSync(uiDir).filter((n) => n.endsWith(".js"))) {
    const code = readFileSync(path.join(uiDir, f), "utf8");
    for (const m of code.matchAll(/\bt\(\s*["']([\w.]+)["']/g)) keys.add(m[1]);
  }
  return keys;
}

test("index.html ve JS'te kullanılan anahtarlar JSON'da var", () => {
  const keys = usedKeys();
  assert.ok(keys.size > 20);
  for (const k of keys) {
    assert.ok(k in tr, `tr eksik: ${k}`);
    assert.ok(k in en, `en eksik: ${k}`);
  }
});

const ERROR_CODES = [
  "REQUIRED", "NOT_A_NUMBER", "NOT_AN_INTEGER", "OUT_OF_RANGE", "NEGATIVE_VALUE", "TOO_LARGE",
  "INVALID_CURRENCY", "BOOKINGS_EXCEED_BOOKED_NIGHTS", "INVALID_INPUT",
  "RESULT_OUT_OF_RANGE", "AMBIGUOUS_NUMBER",
];
const dynamicKeys = () => [
  ...ERROR_CODES.map((c) => `errors.${c}`),
  ...CURRENCIES.map((c) => `currency.${c}`),
  ...FIELD_NAMES.flatMap((f) => [`field.${f}.label`, `field.${f}.hint`, `field.${f}.placeholder`]),
];

test("dinamik anahtarlar (alanlar, para birimleri, hata kodları) var", () => {
  for (const k of dynamicKeys()) {
    assert.ok(k in tr, `tr eksik: ${k}`);
    assert.ok(k in en, `en eksik: ${k}`);
  }
});

test("JSON'daki her anahtar kullanılıyor (kullanılmayan anahtar yok)", () => {
  const used = new Set([...usedKeys(), ...dynamicKeys()]);
  for (const k of Object.keys(en)) assert.ok(used.has(k), `kullanılmayan anahtar: ${k}`);
  assert.ok(!("result.empty" in en));
});

test("yükleme hatası anahtarları kullanılıyor", () => {
  const keys = usedKeys();
  assert.ok(keys.has("errors.loadFailed"));
  assert.ok(keys.has("errors.loadFailedHint"));
});

test("index.html her alan için input + hint + error kimliği içerir", () => {
  const html = readFileSync(path.join(src, "index.html"), "utf8");
  for (const f of FIELD_NAMES) {
    for (const id of [f, `${f}-hint`, `${f}-error`]) {
      assert.ok(html.includes(`id="${id}"`), `id eksik: ${id}`);
    }
  }
});
