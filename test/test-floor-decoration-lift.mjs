// A floor decoration whose pattern lies flat on a base of its own, at the base's height, is drawn with the pattern
// just above it: the Alchemical Hydra's floor tiles (loc 32171) are a light star (faces 0-15) on a dark square
// (faces 16-17), and with the two tied the stars broke up in stripes as the camera moved (the play-test of
// 2026-11-27). The renderer lifts each face lying within a larger one by a height unit, and the merged mesh of the
// map's objects is built with those lifts.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // One route for each file: of two routes on the same file, only the last would run.
  for (const [path, probes] of [
    ["**/encounters/shared/buildScene.js*", [["const scene = new Scene();", "(window.scenes ||= []).push(scene);"]]],
    ["**/assets/rendering.js*", [
      ["var floorDecorationFaceLiftsByModel = new WeakMap();", "window.floorDecorationFaceLifts = (model) => floorDecorationFaceLifts(model);"],
      ["const faceLifts = s.faceLifts;", "if (faceLifts) window.liftedEntries = (window.liftedEntries ?? 0) + 1;"],
    ]],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      for (const [marker, probe] of probes) {
        assert.ok(body.includes(marker), marker);
        body = body.replace(marker, marker + probe);
      }
      await route.fulfill({ response, body });
    });
  }

  await page.goto(origin + "/alchemical-hydra/");
  await page.waitForFunction(() => window.scenes?.some((scene) => scene.locRenderer.isLoaded()), null, { timeout: 90000 });

  const { lifts, liftedEntries } = await page.evaluate(() => {
    const scene = window.scenes.find((candidate) => candidate.locRenderer.isLoaded());
    const { loader } = scene.locRenderer.recipe;
    const model = loader.Yh(loader.loadLocType(32171), 22, 0);
    const { faceLifts } = window.floorDecorationFaceLifts(model);
    return { lifts: faceLifts && Array.from(faceLifts, (lift) => lift * 128), liftedEntries: window.liftedEntries ?? 0 };
  });
  // The star's 16 faces a height unit above the square; the square and the border's 16 faces where they are.
  assert.deepEqual(lifts, [...new Array(16).fill(1), ...new Array(18).fill(0)]);
  // The chamber's floor tiles reach the merged mesh with their lifts (CACHE: 335 of loc 32171 on its map square).
  assert.ok(liftedEntries >= 335, `${liftedEntries} floor decorations merged with lifts`);
  assert.deepEqual(errors, []);
  console.log("floor decoration lift ok");
} finally {
  await browser.close();
}
