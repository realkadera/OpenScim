import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { browserOptions } from "./browser.mjs";
const browser = await chromium.launch(browserOptions);
try {
  for (let round = 0; round < 80; round++) {
    const page = await browser.newPage();
    const missing = new Set();
    page.on("console", (m) => {
      for (const hit of m.text().matchAll(/Empty container (\d+):(\d+)/g))
        missing.add(hit[1] + "-" + hit[2]);
    });
    await page.goto("http://127.0.0.1:5173/zebak/");
    await page.waitForTimeout(2200);
    await page.close();
    if (!missing.size) break;
    for (const name of missing) {
      const [archive, group] = name.split("-");
      const r = await fetch(
        "https://archive.openrs2.org/caches/runescape/2762/archives/" +
          archive +
          "/groups/" +
          group +
          ".dat",
      );
      if (!r.ok) throw Error(r.status + " " + name);
      console.log("Adding " + name);
      await fs.writeFile(
        "evidence/zebak-groups/" + name + ".dat",
        Buffer.from(await r.arrayBuffer()),
      );
    }
    await import("./pack-zebak-cache.mjs?pass=" + round);
  }
} finally {
  await browser.close();
}
