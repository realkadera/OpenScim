#!/usr/bin/env node
// Measures what a visitor waits for: first paint, largest paint, the loading
// screen's end, and how long the main thread was blocked on the way and after.
//
//   npm run build && node tools/measure-vitals.mjs [--routes /,/yama/] [--profiles fast,4g] [--runs 1] [--dist dist]
//
// Serves the build itself (tools/serve-dist.mjs: set SERVE_DIST_KEY and
// SERVE_DIST_CERT for HTTP/2, as the host serves it). Each route is opened
// cold (empty browser storage), left until the network is quiet, so that
// whatever the page stores for its next visit is stored, and reloaded (warm).
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { chromeArgs, chromePath, defaultDist, serveDist } from "./serve-dist.mjs";

const { values: opt } = parseArgs({
  options: {
    routes: { type: "string", default: "/,/yama/" },
    profiles: { type: "string", default: "fast,4g" },
    runs: { type: "string", default: "1" },
    dist: { type: "string", default: defaultDist },
    json: { type: "boolean", default: false },
  },
});

// "4g" is Lighthouse's old "fast 4G" with a mid-range phone's CPU.
const PROFILES = {
  fast: null,
  "4g": { downloadKbps: 9000, uploadKbps: 9000, latencyMs: 40, cpu: 4 },
};
const server = await serveDist(opt.dist);

// Runs before the page's own scripts: collects the paints and the long tasks.
const probe = () => {
  const vitals = (window.__vitals = { lcp: 0, lcpElement: "", blocked: 0, longest: 0 });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      vitals.lcp = entry.startTime;
      const element = entry.element;
      vitals.lcpElement = element ? element.tagName.toLowerCase() + (element.className ? "." + String(element.className).split(" ")[0] : "") : "";
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      vitals.blocked += Math.max(0, entry.duration - 50);
      vitals.longest = Math.max(vitals.longest, entry.duration);
    }
  }).observe({ type: "longtask", buffered: true });
};

async function visit(page, url, reload) {
  if (reload) await page.reload({ waitUntil: "commit" });
  else await page.goto(url, { waitUntil: "commit" });
  // The loading screen is gone when the world is on screen and takes clicks.
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".loading-screen");
      if (screen && !window.__sawLoading) window.__sawLoading = performance.now();
      if (screen?.getAttribute("aria-busy") === "false" && !window.__loaded) window.__loaded = performance.now();
      return window.__sawLoading && (!screen || screen.classList.contains("hidden"));
    },
    null,
    { timeout: 300000, polling: 50 },
  );
  const atWorld = await page.evaluate(() => ({
    fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
    lcp: Math.round(window.__vitals.lcp),
    lcpElement: window.__vitals.lcpElement,
    loaded: Math.round(window.__loaded ?? 0),
    world: Math.round(performance.now()),
    blocked: Math.round(window.__vitals.blocked),
    longest: Math.round(window.__vitals.longest),
  }));
  // What goes on behind the running game: the rest of the downloads, and the
  // cache on its way into browser storage. A tap now waits behind these tasks.
  await page.evaluate(() => {
    window.__vitals.blocked = 0;
    window.__vitals.longest = 0;
  });
  await page.waitForLoadState("networkidle", { timeout: 300000 });
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => ({
    blockedAfter: Math.round(window.__vitals.blocked),
    longestAfter: Math.round(window.__vitals.longest),
    lcpFinal: Math.round(window.__vitals.lcp),
  }));
  return { ...atWorld, ...after };
}

const browser = await chromium.launch({ executablePath: chromePath, args: chromeArgs });
const rows = [];
try {
  for (const profileName of opt.profiles.split(",")) {
    const profile = PROFILES[profileName];
    if (profile === undefined) throw new Error("unknown profile " + profileName);
    for (const route of opt.routes.split(",")) {
      for (let run = 0; run < Number(opt.runs); run++) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: true });
        const page = await context.newPage();
        await page.addInitScript(probe);
        if (profile) {
          const cdp = await context.newCDPSession(page);
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: profile.latencyMs,
            downloadThroughput: (profile.downloadKbps * 1000) / 8,
            uploadThroughput: (profile.uploadKbps * 1000) / 8,
          });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
        }
        rows.push({ profile: profileName, route, visit: "cold", ...(await visit(page, server.origin + route, false)) });
        rows.push({ profile: profileName, route, visit: "warm", ...(await visit(page, server.origin + route, true)) });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (opt.json) console.log(JSON.stringify(rows, null, 2));
else {
  // fcp, lcp: the paints Google scores (lcp as it stood when the world came
  // up; lcp' after the page went quiet). loaded: cache and assets ready.
  // world: the loading screen starts to fade. blocked, longest: main thread
  // time in tasks beyond 50 ms each, and the longest task, until the world;
  // after, longest': the same from the world until the page went quiet.
  console.log(server.protocol + ", " + opt.dist);
  console.log("profile route          visit    fcp    lcp   lcp' loaded  world blocked longest   after longest'  lcp element");
  for (const row of rows)
    console.log(
      [row.profile.padEnd(7), row.route.padEnd(14), row.visit.padEnd(5)].join(" ") +
        [row.fcp, row.lcp, row.lcpFinal, row.loaded, row.world, row.blocked, row.longest, row.blockedAfter, row.longestAfter]
          .map((value) => String(value).padStart(7))
          .join("") +
        "   " +
        row.lcpElement,
    );
}
