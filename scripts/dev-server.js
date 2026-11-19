// Yerel geliştirme sunucusu: yalnızca Node.js yerleşik modülleri, harici bağımlılık yok.
// - Web kökü: src/ (src dışındaki hiçbir dosya sunulmaz).
// - Varsayılan: yalnızca localhost (127.0.0.1) üzerinde dinler; dışarıdan erişilemez.
// - İsteğe bağlı yerel ağ erişimi (ör. iPhone testi): HOST=0.0.0.0 ya da `--lan` bayrağı
//   (`npm run start:lan`). Bu durumda aynı Wi-Fi ağındaki herkes erişebilir; yalnızca güvendiğiniz ağda kullanın.
// - Varsayılan port 8000; PORT ortam değişkeni ile değiştirilebilir.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const LOOPBACK_HOST = "127.0.0.1";
const LAN_HOST = "0.0.0.0";
const DEFAULT_PORT = 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

/**
 * İstek yolunu src içindeki mutlak dosya yoluna çevirir.
 * src dışına çıkan, geçersiz kodlanmış veya null bayt içeren yollar için null döner.
 */
export function resolveSafePath(urlPath, root = ROOT) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const full = resolve(join(root, relative));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

async function pickFile(full) {
  const info = await stat(full).catch(() => null);
  if (!info) return null;
  if (info.isDirectory()) {
    const index = join(full, "index.html");
    return (await stat(index).catch(() => null))?.isFile() ? index : null;
  }
  return info.isFile() ? full : null;
}

/**
 * Dinlenecek adres: --lan bayrağı → 0.0.0.0; yoksa HOST ortam değişkeni; yoksa 127.0.0.1.
 * Boş/yalnızca boşluk içeren HOST yok sayılır.
 */
export function resolveHost(env = {}, argv = []) {
  if (argv.includes("--lan")) return LAN_HOST;
  const host = typeof env.HOST === "string" ? env.HOST.trim() : "";
  return host || LOOPBACK_HOST;
}

/** Adres loopback dışında herkese (veya bir ağ arayüzüne) açık mı? */
export function isNetworkExposed(host) {
  return host !== LOOPBACK_HOST && host !== "localhost" && host !== "::1";
}

/** Yerel ağ IPv4 adresleri (iç olmayan arayüzler). */
export function lanAddresses(interfaces = networkInterfaces()) {
  const out = [];
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      if (info.family === "IPv4" && !info.internal) out.push(info.address);
    }
  }
  return out;
}

/** Başlangıçta terminalde gösterilecek satırlar. */
export function startupMessages(host, port, addresses = lanAddresses()) {
  if (!isNetworkExposed(host)) {
    return [`StayProfit: http://localhost:${port} (kök: src/, yalnızca localhost)`];
  }
  const lines = [`StayProfit (yerel ağ modu, ${host}:${port}, kök: src/)`, `  Bu bilgisayarda: http://localhost:${port}`];
  const reachable = host === LAN_HOST || host === "::" ? addresses : [host];
  if (reachable.length) {
    for (const a of reachable) lines.push(`  Ağdaki cihazlar (iPhone vb.): http://${a}:${port}`);
  } else {
    lines.push("  Yerel ağ adresi bulunamadı; Wi-Fi bağlantısını kontrol edin.");
  }
  lines.push("  UYARI: Aynı ağdaki herkes erişebilir. Yalnızca geliştirme için, güvendiğiniz ağda kullanın.");
  return lines;
}

export function createDevServer(root = ROOT) {
  return createServer(async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
      res.end(body);
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      return send(405, "Method Not Allowed", { Allow: "GET, HEAD" });
    }
    const full = resolveSafePath(req.url ?? "/", root);
    if (!full) return send(403, "Forbidden");

    const file = await pickFile(full);
    if (!file) return send(404, "Not Found");

    try {
      const body = await readFile(file);
      const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": type, "Content-Length": body.length });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      send(500, "Internal Server Error");
    }
  });
}

// Doğrudan çalıştırıldığında (npm start) sunucuyu başlat; import edilince başlatma.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const host = resolveHost(process.env, process.argv.slice(2));
  const server = createDevServer();
  server.on("error", (err) => {
    console.error(
      err.code === "EADDRINUSE"
        ? `Port ${port} kullanımda. Başka bir port için: PORT=8080 npm start`
        : err.message,
    );
    process.exit(1);
  });
  server.listen(port, host, () => {
    for (const line of startupMessages(host, port)) console.log(line);
  });
}
