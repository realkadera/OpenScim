// Item icons missing locally fall back to RuneLite's icon host, and the setup picker shows them (#104). An icon
// missing from both is hidden instead of showing as a broken image. The host is stubbed, so this needs no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright-core";
import {browserOptions} from "../tools/browser.mjs";

const hostIcon = fs.readFileSync(new URL("../client/assets/items/28951.png", import.meta.url));
const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const asked = [];
  await page.route("https://static.runelite.net/cache/item/icon/*", (route) => {
    const id = /\/(\d+)\.png$/.exec(route.request().url())[1];
    asked.push(Number(id));
    if (id === "999999999") return route.fulfill({status: 404, body: ""});
    return route.fulfill({status: 200, contentType: "image/png", body: hostIcon, headers: {"Access-Control-Allow-Origin": "*"}});
  });
  // The Alchemical Hydra's first setup wears a helmet (11865). Its local icon is taken away here, so that the test
  // doesn't depend on which icons the manifest has: 11865 got one (#181) and the test failed.
  await page.route("**/assets/items/11865.png", (route) => route.fulfill({status: 404, body: ""}));
  await page.goto(process.env.TEST_ORIGIN + "/");

  await page.getByRole("button", {name: "Menu", exact: true}).click();
  await page.getByText("Encounters", {exact: true}).click();
  await page.getByPlaceholder("Search encounters...").fill("hydra");
  await page.getByText("Alchemical Hydra", {exact: true}).first().click();
  await page.getByRole("button", {name: "Edit setup", exact: true}).click();
  const head = page.locator(".equip-slot img[alt='Head']");
  await head.waitFor({state: "attached"});
  await page.waitForFunction(() => document.querySelector(".equip-slot img[alt='Head']")?.naturalWidth > 0);
  const shown = await head.evaluate((image) => ({src: image.src, display: image.style.display, width: image.naturalWidth}));
  assert.equal(shown.src, "https://static.runelite.net/cache/item/icon/11865.png");
  assert.notEqual(shown.display, "none", "the host's icon is shown, not hidden by the slot's first error");
  assert.ok(await head.isVisible());

  // Missing from both: hidden.
  const missing = await page.evaluate(async () => {
    const image = document.createElement("img");
    image.src = "/assets/items/999999999.png";
    document.body.append(image);
    for (let wait = 0; wait < 100 && image.style.display !== "none"; wait++) await new Promise((r) => setTimeout(r, 50));
    image.remove();
    return {src: image.src, display: image.style.display};
  });
  assert.equal(missing.src, "https://static.runelite.net/cache/item/icon/999999999.png");
  assert.equal(missing.display, "none");
  assert.ok(asked.includes(11865) && asked.includes(999999999));
  console.log("The Hydra setup's helmet shows RuneLite's icon, and an icon missing from both places is hidden.");
} finally {
  await browser.close();
}
