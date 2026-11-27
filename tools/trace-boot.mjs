#!/usr/bin/env node
// Prints what a cold visit waits for, in order: every request with when it
// started and ended, and the cache loader's log lines.
//
//   npm run build && node tools/trace-boot.mjs [--route /yama/] [--profile 4g]
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { chromeArgs, chromePath, serveDist } from "./serve-dist.mjs";

const { values: opt } = parseArgs({
  options: { route: { type: "string", default: "/yama/" }, profile: { type: "string", default: "4g" }, min: { type: "string", default: "150" }, after: { type: "string", default: "3000" } },
});
const server = await serveDist();
const browser = await chromium.launch({
  executablePath: chromePath,
  args: chromeArgs,
});
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (opt.profile === "4g") {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 1125000, uploadThroughput: 1125000 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const start = Date.now();
  const at = () => String(Date.now() - start).padStart(6);
  const lines = [];
  const began = new Map();
  page.on("request", (request) => began.set(request, Date.now() - start));
  page.on("requestfinished", async (request) => {
    const took = Date.now() - start - began.get(request);
    const size = (await request.sizes().catch(() => null))?.responseBodySize ?? 0;
    if (took >= Number(opt.min) || size > 200000)
      lines.push([Date.now() - start, at() + "  net  " + String(began.get(request)).padStart(6) + " +" + String(took).padStart(5) + "ms " + String(Math.round(size / 1024)).padStart(6) + "KB  " + request.url().replace(server.origin, "").slice(0, 90)]);
  });
  page.on("requestfailed", (request) => lines.push([Date.now() - start, at() + "  FAIL " + request.failure()?.errorText + "  " + request.url().replace(server.origin, "").slice(0, 90)]));
  page.on("console", (message) => {
    const text = message.text();
    if (/Cache|cache|Perf|preload/.test(text)) lines.push([Date.now() - start, at() + "  log  " + text.slice(0, 160)]);
  });
  await page.goto(server.origin + opt.route, { waitUntil: "commit" });
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".loading-screen");
      return window.__reactSeen ? !screen || screen.classList.contains("hidden") : ((window.__reactSeen = !!screen && screen.getAttribute("aria-busy") !== null && !!document.querySelector("canvas")), false);
    },
    null,
    { timeout: 300000, polling: 50 },
  );
  lines.push([Date.now() - start, at() + "  ---  world on screen"]);
  await page.waitForTimeout(Number(opt.after));
  for (const [, line] of lines.sort((a, b) => a[0] - b[0])) console.log(line);
} finally {
  await browser.close();
  server.close();
}
