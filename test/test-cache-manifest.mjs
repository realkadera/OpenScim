// A browser that was here before a deploy gets the new game cache on its next
// visit, though the server lets it keep manifest.json for a day (openscim.dev
// does: "public, max-age=86400"). With the old manifest it kept the old
// disk.zip, and every fight added since loaded to a black screen.
//
// No page.route here: Playwright turns the HTTP cache off with it. A server in
// front of the tests' own serves the cache instead, and deploys another one.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const { hostname: host, port } = new URL(process.env.TEST_ORIGIN);
const upstream = { host, port };
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "client/osrs-cache/manifest.json"), "utf8"));
const zip = fs.readFileSync(path.join(repo, "client/osrs-cache/disk.zip"));

// The same cache as another deploy would have it: its bytes, and so its
// checksum, differ by the comment at the end of the zip.
const END = 22; // the end of central directory record, when there is no comment
assert.equal(zip.readUInt32LE(zip.length - END), 0x06054b50, "disk.zip ends without a comment");
const deploy = (comment) => {
  const bytes = Buffer.concat([zip, Buffer.from(comment)]);
  bytes.writeUInt16LE(comment.length, zip.length - 2);
  const diskZipSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return { bytes, diskZipSha256, manifest: JSON.stringify({ ...manifest, size: bytes.length, diskZipBytes: bytes.length, diskZipSha256 }) };
};
const before = deploy("before");
const after = deploy("after");

let deployed = before;
let requests = [];
const server = http.createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  if (pathname.startsWith("/osrs-cache/")) requests.push(pathname);
  const serve = (type, body) => {
    const etag = '"' + crypto.createHash("sha256").update(body).digest("hex") + '"';
    const headers = { "cache-control": "public, max-age=86400", "content-type": type, etag };
    if (request.headers["if-none-match"] === etag) return response.writeHead(304, headers).end();
    response.writeHead(200, { ...headers, "content-length": Buffer.byteLength(body) }).end(body);
  };
  if (pathname === "/osrs-cache/manifest.json") return serve("application/json", deployed.manifest);
  if (pathname === "/osrs-cache/disk.zip") return serve("application/zip", deployed.bytes);
  const forward = http.request({ ...upstream, path: request.url, method: request.method, headers: request.headers }, (answer) => {
    response.writeHead(answer.statusCode, answer.headers);
    answer.pipe(response);
  });
  forward.on("error", () => response.destroy());
  request.pipe(forward);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  // The checksum of the cache the browser keeps, once there is one.
  const stored = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("osrs-yama-cache", 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const read = open.result.transaction("meta").objectStore("meta").getAll();
            read.onsuccess = () => {
              open.result.close();
              resolve(read.result.map((meta) => meta.manifestHash));
            };
          };
        }),
    );
  const visit = async () => {
    requests = [];
    await page.goto(origin + "/vardorvis/");
    await page.locator(".loading-screen").waitFor({ state: "visible", timeout: 60000 });
    await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
    return requests;
  };

  assert.deepEqual((await visit()).filter((name) => name !== "/osrs-cache/keys.json"), ["/osrs-cache/manifest.json", "/osrs-cache/disk.zip"]);
  assert.deepEqual(await stored(), [before.diskZipSha256], "the first visit keeps the deployed cache");

  // Nothing new: the manifest is asked for, the cache is not downloaded again.
  const same = await visit();
  assert.ok(same.includes("/osrs-cache/manifest.json"), "the server is asked for the manifest, not the HTTP cache");
  assert.ok(!same.includes("/osrs-cache/disk.zip"), "an unchanged cache is not downloaded again");
  assert.deepEqual(await stored(), [before.diskZipSha256]);

  deployed = after;
  assert.ok((await visit()).includes("/osrs-cache/disk.zip"), "the new cache is downloaded on the first visit after its deploy");
  assert.deepEqual(await stored(), [after.diskZipSha256], "and replaces the old one");
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
console.log("cache manifest: a new cache replaces the one the browser keeps, whatever the HTTP cache holds");
