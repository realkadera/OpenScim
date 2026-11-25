import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

await loadEnvironment(); // client modules resolve web-root imports through the harness loader
const [{ getWeaponCategory }, { getPoweredStaffBaseMaxHit }] = await Promise.all([
  import("../client/data/weaponCategories.js"),
  import("../client/engine/weapons.js"),
]);

test("corrupted Gauntlet weapon tiers retain their attack categories and staff base hits", () => {
  for (let tier = 0; tier < 3; tier++) {
    assert.equal(getWeaponCategory(23849 + tier), "polearm");
    assert.equal(getWeaponCategory(23852 + tier), "powered_staff");
    assert.equal(getWeaponCategory(23855 + tier), "bow");
    assert.equal(getPoweredStaffBaseMaxHit(23852 + tier, 99), [23, 31, 39][tier]);
  }
});
