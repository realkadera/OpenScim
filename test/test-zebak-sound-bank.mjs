import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  await page.goto(process.env.TEST_ORIGIN + "/zebak/?sound=toa_zebak");
  const rows = page.locator(".cache-explorer-modal .sidebar-item");
  await page.waitForFunction(() => document.querySelectorAll(".cache-explorer-modal .sidebar-item").length === 105);
  const decoded = await page.evaluate(async () => {
    const {zebakSoundNames} = await import("/toa/zebak/sounds.js");
    const {soundEffectResponse} = await import("/audio/soundEffects.js");
    const cache = new (await import("/assets/player.js")).CacheManager();
    await cache.ensureCache();
    const context = new OfflineAudioContext(1, 1, 22050);
    const ids = Object.keys(zebakSoundNames).map(Number);
    for (const id of ids) {
      const response = await soundEffectResponse(cache, id);
      if (!response.ok) throw Error("Missing sound " + id);
      const clip = await context.decodeAudioData(await response.arrayBuffer());
      if (!(clip.duration > 0) || !clip.getChannelData(0).some(sample => Math.abs(sample) > 0.001))
        throw Error("Empty sound " + id);
    }
    return ids;
  });
  assert.deepEqual(decoded, Array.from({length: 106}, (_, n) => 5818 + n));
  await page.evaluate(() => {
    document.addEventListener("playing", event => { window.testAuditionUrl = event.target.currentSrc; }, true);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      this.addEventListener("playing", () => { window.testAuditionUrl = this.currentSrc; }, {once:true});
      return play.call(this);
    };
  });
  await rows.filter({hasText: "toa_zebak_jug_break_02"}).click();
  await page.locator(".sound-play-btn").first().click();
  await page.waitForFunction(() => /^blob:.*#5869$/.test(window.testAuditionUrl ?? ""));
  console.log("Cache Explorer listed 105 Zebak entries, all 106 effects synthesized from the cache decoded with audible samples, and jug variant 5869 played.");
} finally {
  await browser.close();
}
