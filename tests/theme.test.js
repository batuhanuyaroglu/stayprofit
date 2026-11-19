import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveTheme, nextTheme, applyTheme, THEME_COLORS } from "../src/js/ui/theme.js";
import { loadTheme, saveTheme } from "../src/js/ui/storage.js";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

test("resolveTheme: kayıtlı geçerli tercih önce gelir", () => {
  assert.equal(resolveTheme({ stored: "dark", prefersDark: false }), "dark");
  assert.equal(resolveTheme({ stored: "light", prefersDark: true }), "light");
});

test("resolveTheme: geçersiz stored yok sayılır, sistem tercihi kullanılır", () => {
  for (const bad of ["blue", "", null, undefined, 1, "DARK"]) {
    assert.equal(resolveTheme({ stored: bad, prefersDark: true }), "dark");
    assert.equal(resolveTheme({ stored: bad, prefersDark: false }), "light");
  }
  assert.equal(resolveTheme({}), "light");
  assert.equal(resolveTheme(), "light");
});

test("nextTheme geçişi", () => {
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "light");
});

test("saveTheme/loadTheme: yalnızca light|dark", () => {
  const s = fakeStorage();
  assert.equal(saveTheme("dark", s), true);
  assert.equal(loadTheme(s), "dark");
  assert.equal(saveTheme("purple", s), false);
  assert.equal(saveTheme(undefined, s), false);
  assert.equal(s.data["stayprofit.theme"], "dark");
  assert.equal(loadTheme(fakeStorage({ "stayprofit.theme": "garbage" })), null);
  assert.equal(loadTheme(fakeStorage()), null);
});

test("storage hatasında throw etmez", () => {
  assert.equal(loadTheme(throwingStorage), null);
  assert.equal(saveTheme("light", throwingStorage), false);
  assert.equal(loadTheme(null), null);
});

function fakeDoc({ withMeta }) {
  const attrs = {};
  const metas = [];
  const makeMeta = () => {
    const a = {};
    return { a, setAttribute: (k, v) => (a[k] = v) };
  };
  if (withMeta) metas.push(makeMeta());
  return {
    attrs,
    metas,
    documentElement: { setAttribute: (k, v) => (attrs[k] = v) },
    querySelector: () => metas[0] ?? null,
    createElement: () => makeMeta(),
    head: { appendChild: (m) => metas.push(m) },
  };
}

test("applyTheme data-theme yazar ve mevcut meta theme-color'ı günceller", () => {
  const doc = fakeDoc({ withMeta: true });
  assert.equal(applyTheme("dark", doc), true);
  assert.equal(doc.attrs["data-theme"], "dark");
  assert.equal(doc.metas[0].a.content, THEME_COLORS.dark);
  applyTheme("light", doc);
  assert.equal(doc.attrs["data-theme"], "light");
  assert.equal(doc.metas[0].a.content, THEME_COLORS.light);
});

test("applyTheme meta yoksa ekler; geçersiz temayı reddeder", () => {
  const doc = fakeDoc({ withMeta: false });
  assert.equal(applyTheme("dark", doc), true);
  assert.equal(doc.metas.length, 1);
  assert.equal(doc.metas[0].a.name, "theme-color");
  assert.equal(applyTheme("pink", doc), false);
  assert.equal(doc.attrs["data-theme"], "dark");
});

const css = readFileSync(path.join(src, "css", "tokens.css"), "utf8");

function block(startRe) {
  const m = startRe.exec(css);
  assert.ok(m, `blok yok: ${startRe}`);
  const end = css.indexOf("}", m.index);
  return css.slice(m.index, end);
}
const colorVars = (b) => new Set([...b.matchAll(/(--color-[\w-]+)\s*:/g)].map((m) => m[1]));

test("koyu tema bloğu açık temadaki her --color-* değişkenini yeniden tanımlar", () => {
  const light = colorVars(block(/^:root\s*\{/m));
  const dark = colorVars(block(/^:root\[data-theme="dark"\]\s*\{/m));
  assert.ok(light.size > 15);
  const missing = [...light].filter((v) => !dark.has(v));
  assert.deepEqual(missing, [], `koyu temada eksik: ${missing.join(", ")}`);
  const extra = [...dark].filter((v) => !light.has(v));
  assert.deepEqual(extra, [], `açık temada tanımsız: ${extra.join(", ")}`);
});

test("index.html: tema script'i CSS'ten önce ve favicon bağlı", () => {
  const html = readFileSync(path.join(src, "index.html"), "utf8");
  assert.ok(html.indexOf("stayprofit.theme") < html.indexOf("css/tokens.css"));
  assert.ok(html.includes('rel="icon" href="favicon.svg"'));
  assert.ok(html.includes('id="theme-toggle"'));
});
