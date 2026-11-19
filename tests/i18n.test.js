import { test } from "node:test";
import assert from "node:assert/strict";

// Modül düzeyi önbellek (dicts) paylaşıldığı için her test taze bir modül örneği yükler.
let n = 0;
const fresh = () => import(`../src/js/ui/i18n.js?case=${n++}`);

const dict = (lang) => ({ "meta.title": `title-${lang}`, "errors.loadFailed": `failed-${lang}` });

test("seçili dil yüklenir", async () => {
  const i18n = await fresh();
  const out = await i18n.setLanguage("tr", async (l) => dict(l));
  assert.deepEqual(out, { lang: "tr", usedFallback: false, failed: false });
  assert.equal(i18n.getLang(), "tr");
  assert.equal(i18n.t("errors.loadFailed"), "failed-tr");
});

test("seçili dil başarısız -> yedek dil, usedFallback", async () => {
  const i18n = await fresh();
  const loader = async (l) => {
    if (l === "tr") throw new Error("network");
    return dict(l);
  };
  const out = await i18n.setLanguage("tr", loader);
  assert.deepEqual(out, { lang: "en", usedFallback: true, failed: false });
  assert.equal(i18n.getLang(), "en");
  assert.equal(i18n.t("errors.loadFailed"), "failed-en");
});

test("en başarısız -> tr'ye düşer", async () => {
  const i18n = await fresh();
  const out = await i18n.setLanguage("en", async (l) => {
    if (l === "en") throw new Error("404");
    return dict(l);
  });
  assert.deepEqual(out, { lang: "tr", usedFallback: true, failed: false });
});

test("ikisi de başarısız -> failed, throw yok", async () => {
  const i18n = await fresh();
  const out = await i18n.setLanguage("tr", async () => {
    throw new Error("down");
  });
  assert.deepEqual(out, { lang: null, usedFallback: false, failed: true });
});

test("loader'ın döndürdüğü reddedilen promise ve senkron hata yakalanır", async () => {
  const i18n = await fresh();
  const out = await i18n.loadWithFallback("en", () => Promise.reject(new SyntaxError("bad json")));
  assert.equal(out.failed, true);
  const i2 = await fresh();
  const out2 = await i2.loadWithFallback("en", () => {
    throw new Error("sync");
  });
  assert.equal(out2.failed, true);
});

test("varsayılan loader: fetch hatası, HTTP !ok ve geçersiz JSON hata fırlatır", async () => {
  const i18n = await fresh();
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    await assert.rejects(i18n.fetchLocale("en"));
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(i18n.fetchLocale("en"), /404/);
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    await assert.rejects(i18n.fetchLocale("en"));
    globalThis.fetch = async () => ({ ok: true, json: async () => ["x"] });
    await assert.rejects(i18n.fetchLocale("en"));
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ a: "b" }) });
    assert.deepEqual(await i18n.fetchLocale("en"), { a: "b" });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("t: bilinmeyen anahtar kendisini, parametreleri doldurur", async () => {
  const i18n = await fresh();
  await i18n.setLanguage("en", async () => ({ x: "max {max}" }));
  assert.equal(i18n.t("x", { max: 5 }), "max 5");
  assert.equal(i18n.t("yok"), "yok");
});
