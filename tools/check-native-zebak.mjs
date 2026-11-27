import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "./browser.mjs";
const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Failed to load (terrain|loc|SkeletalSeq)|Empty container|Bzip2Unavailable/.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5173/toa/zebak/");
  await page.waitForURL("http://127.0.0.1:5173/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  await page.waitForTimeout(2500);
  await page.mouse.move(631, 226);
  await page.waitForFunction(
    () => document.body.innerText.includes("Attack Zebak"),
    {},
    { timeout: 30000 },
  );
  await page.mouse.click(631, 226);
  await page.waitForFunction(
    () => {
      const match = document.body.innerText.match(/(\d+)\/580/);
      return match && Number(match[1]) < 580;
    },
    {},
    { timeout: 30000 },
  );
  console.log(
    "Native attack landed",
    await page
      .locator("body")
      .innerText()
      .then((s) => s.match(/\d+\/580/)[0]),
  );
  await page.screenshot({ path: "evidence/zebak-native.png" });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
