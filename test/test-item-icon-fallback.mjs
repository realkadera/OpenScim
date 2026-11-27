// An item icon that is not in client/assets/items/ must load from the remote icon host.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  // Pretend the local copy is missing, whatever is on disk.
  await page.route("**/assets/items/4151.png", route => route.fulfill({ status: 404 }));
  await page.goto(process.env.TEST_ORIGIN + "/");
  await page.waitForFunction(() => document.querySelector("#root")?.childElementCount > 0);
  const result = await page.evaluate(() => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ src: image.src, width: image.naturalWidth });
    setTimeout(() => resolve({ src: image.src, width: 0 }), 15000);
    document.body.append(image);
    image.src = "/assets/items/4151.png";
  }));
  assert.equal(result.src, "https://static.runelite.net/cache/item/icon/4151.png");
  assert.ok(result.width > 0, "remote icon did not load");
  console.log("Missing local item icon loaded from", result.src);
} finally {
  await browser.close();
}
