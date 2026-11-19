import { test, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createDevServer, resolveSafePath, resolveHost, isNetworkExposed, lanAddresses, startupMessages } from "../scripts/dev-server.js";

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

test("resolveHost: varsayılan 127.0.0.1; HOST ve --lan desteklenir", () => {
  assert.equal(resolveHost({}, []), "127.0.0.1");
  assert.equal(resolveHost({ HOST: "" }, []), "127.0.0.1");
  assert.equal(resolveHost({ HOST: "   " }, []), "127.0.0.1");
  assert.equal(resolveHost({ HOST: "0.0.0.0" }, []), "0.0.0.0");
  assert.equal(resolveHost({ HOST: "192.168.1.5" }, []), "192.168.1.5");
  assert.equal(resolveHost({}, ["--lan"]), "0.0.0.0");
  assert.equal(resolveHost({ HOST: "127.0.0.1" }, ["--lan"]), "0.0.0.0");
});

test("isNetworkExposed: loopback dışı adresler ağa açık sayılır", () => {
  assert.equal(isNetworkExposed("127.0.0.1"), false);
  assert.equal(isNetworkExposed("localhost"), false);
  assert.equal(isNetworkExposed("0.0.0.0"), true);
  assert.equal(isNetworkExposed("192.168.1.5"), true);
});

test("lanAddresses: yalnızca iç olmayan IPv4 adresleri", () => {
  const ifaces = {
    lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    wifi: [
      { family: "IPv6", address: "fe80::1", internal: false },
      { family: "IPv4", address: "192.168.1.23", internal: false },
    ],
    empty: undefined,
  };
  assert.deepEqual(lanAddresses(ifaces), ["192.168.1.23"]);
});

test("startupMessages: varsayılan modda yalnızca localhost; LAN modunda adresler ve uyarı", () => {
  const local = startupMessages("127.0.0.1", 8000, ["192.168.1.23"]);
  assert.equal(local.length, 1);
  assert.ok(local[0].includes("http://localhost:8000"));
  assert.ok(!local.join("\n").includes("192.168"));

  const lan = startupMessages("0.0.0.0", 8000, ["192.168.1.23", "10.0.0.7"]).join("\n");
  assert.ok(lan.includes("http://192.168.1.23:8000"));
  assert.ok(lan.includes("http://10.0.0.7:8000"));
  assert.ok(lan.includes("UYARI"));

  const none = startupMessages("0.0.0.0", 8000, []).join("\n");
  assert.ok(none.includes("bulunamadı"));
});

test("güvenlik kontrolleri LAN modunda da geçerlidir (0.0.0.0 üzerinde dinleyen sunucu)", async () => {
  const lanServer = createDevServer(root);
  await new Promise((ok) => lanServer.listen(0, "0.0.0.0", ok));
  const url = `http://127.0.0.1:${lanServer.address().port}`;
  try {
    assert.equal((await fetch(url + "/")).status, 200);
    const r = await fetch(url + "/%2e%2e/package.json");
    assert.doesNotMatch(await r.text(), /"scripts"/);
    assert.equal((await fetch(url + "/", { method: "POST" })).status, 405);
  } finally {
    lanServer.close();
  }
});
