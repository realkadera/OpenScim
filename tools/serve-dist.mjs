// Serves a built dist/ on a free local port the way the host does: text
// compressed, an unknown path is the app, a missing file is a 404. For the
// tools that open the built site in a browser (vite preview does not
// compress, so a throttled run would pay four times for the bundle).
//
// With SERVE_DIST_KEY and SERVE_DIST_CERT (paths of a PEM key and
// certificate; self-signed will do, the tools ignore certificate errors) it
// serves HTTP/2 as the host does. Without them it serves HTTP/1.1, where the
// browser's six connections make the thousand small images of a first visit
// cost several times what they cost a visitor: compare runs, do not quote them.
//
//   openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=127.0.0.1" -keyout key.pem -out cert.pem
import { createServer } from "node:http";
import { createSecureServer } from "node:http2";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".zip": "application/zip",
  ".ogg": "audio/ogg",
};
const COMPRESSIBLE = /\.(html|js|css|json|svg|wasm|ttf|dat|bin)$/;

export const defaultDist = path.resolve(import.meta.dirname, "..", "dist");
export { browserPath as chromePath } from "./browser.mjs";
/** Chrome flags for a machine without a GPU the page accepts, and for the self-signed certificate. */
export const chromeArgs = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--ignore-certificate-errors"];

/** Resolves to { origin, protocol, close }. */
export async function serveDist(dist = defaultDist) {
  if (!existsSync(path.join(dist, "index.html"))) throw new Error(dist + " has no index.html: npm run build first");
  const compressed = new Map();
  const handle = async (request, response) => {
    const url = decodeURIComponent(request.url.split("?")[0]);
    let file = path.join(dist, url);
    if (!file.startsWith(dist)) return response.writeHead(403).end();
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (path.extname(url)) return response.writeHead(404).end();
      file = path.join(dist, "index.html");
    }
    const headers = { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" };
    let body = await readFile(file);
    if (COMPRESSIBLE.test(file) && /\bgzip\b/.test(request.headers["accept-encoding"] ?? "")) {
      if (!compressed.has(file)) compressed.set(file, gzipSync(body));
      body = compressed.get(file);
      headers["Content-Encoding"] = "gzip";
    }
    headers["Content-Length"] = body.length;
    headers["Cache-Control"] = file.endsWith(".html") || file.endsWith("manifest.json") ? "no-cache" : "public, max-age=31536000";
    response.writeHead(200, headers).end(body);
  };
  const { SERVE_DIST_KEY: key, SERVE_DIST_CERT: cert } = process.env;
  const secure = Boolean(key && cert);
  // A write to a request the page has cancelled (a reload cancels them all) must not end the run.
  const safely = (request, response) => handle(request, response).catch(() => response.destroy?.());
  // maxSessionMemory (megabytes): Node counts a queued response against its
  // session, and past the default 10 it refuses the session's other requests,
  // which the cache's 24 MB would do to the images requested beside it.
  const server = secure
    ? createSecureServer({ key: readFileSync(key), cert: readFileSync(cert), allowHTTP1: true, maxSessionMemory: 512 }, safely)
    : createServer(safely);
  server.on("error", () => {});
  server.on("sessionError", () => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: (secure ? "https" : "http") + "://127.0.0.1:" + server.address().port,
    protocol: secure ? "HTTP/2" : "HTTP/1.1",
    close: () => server.close(),
  };
}
