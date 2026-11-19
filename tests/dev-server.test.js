import { test, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createDevServer, resolveSafePath } from "../scripts/dev-server.js";

const root = resolve("src");
const server = createDevServer(root);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("resolveSafePath: src dışına çıkan yollar reddedilir veya src içinde kalır", () => {
  // Kökten başlayan ".." normalize ile kök içinde kalır; asıl koşul: sonuç asla src dışında olmaz.
  for (const p of ["/../package.json", "/%2e%2e/package.json", "/..%2f..%2fCLAUDE.md", "/a/../../tests/x.js", "/..\\..\\CLAUDE.md"]) {
    const r = resolveSafePath(p, root);
    assert.ok(r === null || r.startsWith(root + "\\") || r.startsWith(root + "/"), `${p} -> ${r}`);
  }
  assert.equal(resolveSafePath("/%00", root), null);
  assert.equal(resolveSafePath("/%E0%A4%A", root), null);
  assert.ok(resolveSafePath("/css/base.css", root)?.startsWith(root));
});

test("kök yol index.html'i text/html ile sunar", async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^text\/html/);
});

test("CSS, JS ve JSON doğru Content-Type ile sunulur", async () => {
  const cases = [
    ["/css/base.css", /^text\/css/],
    ["/js/ui/main.js", /^text\/javascript/],
    ["/calculator/calculateProfit.js", /^text\/javascript/],
    ["/locales/tr.json", /^application\/json/],
  ];
  for (const [path, type] of cases) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get("content-type"), type, path);
  }
});

test("src dışındaki dosyalar sunulmaz", async () => {
  for (const path of ["/../package.json", "/%2e%2e/package.json", "/..%2fCLAUDE.md"]) {
    const r = await fetch(base + path);
    assert.ok([403, 404].includes(r.status), `${path} -> ${r.status}`);
    assert.doesNotMatch(await r.text(), /"scripts"|# StayProfit/);
  }
});

test("olmayan dosya 404, POST 405", async () => {
  assert.equal((await fetch(`${base}/yok.html`)).status, 404);
  assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405);
});

test("sunucu yalnızca loopback adresinde dinler", () => {
  assert.equal(server.address().address, "127.0.0.1");
});
