// A spore of Vardorvis's strangle that is clicked fades out once and is gone
// (client/encounters/vardorvis/strangle.js). Two ways it flashed: one clicked
// while it was still fading in jumped to full opacity before it faded; and
// its going animation was timed by the length of the sequence the shared
// view had drawn last (another spore's idle), so it ran past its end, began
// again, and the spore showed whole for a moment as it faded.
// The page is sampled on every frame: each spore's opacity and how much its
// own canvas draws (the sum of its pixels' alpha).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  const [path, marker, probe] = ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'vardorvis') window.engine = this;"];
  await page.route(path, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + probe) });
  });
  await page.goto(origin + "/vardorvis/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  await page.waitForFunction(() => engine.currentTick >= 1, null, { timeout: 60000 });

  const clicked = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    // A strangle now, held long enough for the clicks to be taken one at a time.
    const encounter = engine.encounter;
    encounter.startStrangle({ tick: engine.currentTick });
    encounter.held.failTick += 20;
    const samples = [];
    let sampling = true;
    const sample = () => {
      if (!sampling) return;
      const targets = [...document.querySelectorAll(".vardorvis-strangle div[title='Destroy']")];
      samples.push({
        at: performance.now(),
        spores: targets.map((target) => {
          const canvas = target.querySelector("canvas");
          const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let alpha = 0;
          for (let at = 3; at < data.length; at += 4) alpha += data[at];
          return { opacity: Number(target.style.opacity), hidden: target.style.display === "none", alpha };
        }),
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    while (!document.querySelector(".vardorvis-strangle div[title='Destroy']")) await wait(10);
    const click = (index) => {
      document.querySelectorAll(".vardorvis-strangle div[title='Destroy']")[index].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      return performance.now();
    };
    // Spore 1 while it is fading in, spore 0 once it is in and idle.
    await wait(150);
    const comingAt = click(1);
    await wait(1000);
    const idleAt = click(0);
    await wait(1000);
    sampling = false;
    // Each clicked spore: its last sample before the click and every one after, while it shows.
    const of = (index, at) => {
      const before = samples.filter((each) => each.at < at).at(-1).spores[index];
      const after = samples.filter((each) => each.at > at && !each.spores[index].hidden).map((each) => each.spores[index]);
      return { before, after, frames: after.length };
    };
    return [of(1, comingAt), of(0, idleAt)];
  });

  for (const [name, { before, after, frames }] of [["clicked while coming in", clicked[0]], ["clicked when in", clicked[1]]]) {
    assert.ok(frames >= 10, `${name}: sampled over its fade (${frames} frames)`);
    // It fades from where it was, and only down.
    assert.ok(after[0].opacity <= before.opacity + 0.05, `${name}: no jump in opacity at the click (${before.opacity} to ${after[0].opacity})`);
    for (let at = 1; at < after.length; at++)
      assert.ok(after[at].opacity <= after[at - 1].opacity + 1e-6, `${name}: opacity only falls (frame ${at}: ${after[at - 1].opacity} to ${after[at].opacity})`);
    // Its going animation plays once: once it has nearly gone it does not come back.
    const peak = Math.max(before.alpha, after[0].alpha);
    const low = after.findIndex((each) => each.alpha < peak * 0.25);
    assert.ok(low >= 0, `${name}: its going animation fades it`);
    const back = after.slice(low).find((each) => each.alpha > peak * 0.5);
    assert.equal(back, undefined, `${name}: it does not show whole again as it fades`);
  }
  assert.deepEqual(errors, []);
  console.log("A clicked spore fades out once, from where it was, whether coming in or in");
} finally {
  await browser.close();
}
