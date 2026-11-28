// The rat bone weapons, made from Scurrius' spine (WIKI: Bone mace, Bone
// shortbow, Bone staff): a spiked mace, a bow that fires arrows up to
// amethyst, and a powered staff; each adds 10 to the max hit against rats,
// attacks the giant rats Scurrius summons with no attack cooldown (his
// encounter's rules), and attacks nothing but rats. Fights of the harness,
// no browser.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, loadEnvironment, runScenario } from "../tools/determinism/harness.mjs";
import { attack, protect } from "../tools/determinism/scenarios/common.mjs";
import { scenarios } from "../tools/determinism/scenarios/scurrius.mjs";
import { scurriusLoadouts } from "../client/encounters/scurrius/loadouts.js";

const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;
// The harness's environment (its loader hooks, the cache) before the client's modules, which reach a stylesheet.
if (!skip) await loadEnvironment();
const client = skip
  ? {}
  : {
      ...(await import("../client/engine/playerAttack/profiles.js")),
      ...(await import("../client/data/weaponCategories.js")),
      ...(await import("../client/engine/ammunition.js")),
    };

const BONE_MACE = 28792;
const BONE_SHORTBOW = 28794;
const BONE_STAFF = 28796;
const ABYSSAL_WHIP = 4151;
const arrows = { amethyst: 21326, dragon: 11212 };

test("the bone weapons' categories, arrows and +10 against rats", { skip }, () => {
  const { getWeaponCategory, weaponRequiresAmmo, isAmmoCompatibleWithWeapon, selectPlayerAttackProfile } = client;
  assert.equal(getWeaponCategory(BONE_MACE), "spiked");
  assert.equal(getWeaponCategory(BONE_SHORTBOW), "bow");
  assert.equal(getWeaponCategory(BONE_STAFF), "powered_staff");
  assert.ok(weaponRequiresAmmo(BONE_SHORTBOW));
  assert.ok(isAmmoCompatibleWithWeapon(BONE_SHORTBOW, arrows.amethyst));
  assert.ok(!isAmmoCompatibleWithWeapon(BONE_SHORTBOW, arrows.dragon)); // WIKI: up to amethyst

  const profile = (weaponId, targetAttributes, formulaStyle = "melee_crush") => selectPlayerAttackProfile({ weaponId, formulaStyle, targetAttributes });
  for (const weaponId of [BONE_MACE, BONE_SHORTBOW]) {
    assert.equal(profile(weaponId, ["rat"]).maxHitFlatBonus, 10, String(weaponId));
    assert.equal(profile(weaponId, ["rat", "undead"]).maxHitFlatBonus, 10, String(weaponId));
    assert.equal(profile(weaponId, []).maxHitFlatBonus, undefined, String(weaponId));
  }
  assert.equal(profile(ABYSSAL_WHIP, ["rat"], "melee_slash").maxHitFlatBonus, undefined);
});

// The max hit the engine gives the player against its target, as the DPS overlay reads it.
const maxHitAgainst = (engine, targetId, attributes) => {
  const target = engine.worldState.getNpcs().find((npc) => npc.id === targetId);
  const kept = target.formulaStats.attributes;
  target.formulaStats.attributes = attributes;
  engine.player().attackTarget = targetId;
  const { maxHit } = engine.getAdjustedTheoreticalDps();
  target.formulaStats.attributes = kept;
  return maxHit;
};

test("in Scurrius' fight: +10 against him, and his rats a tick apart", { skip }, async () => {
  const scenario = scenarios.find(({ name }) => name === "scurrius/bone-shortbow-kill");
  const maxHits = {};
  const ratShots = [];
  await runScenario(
    {
      ...scenario,
      name: "rat-bone",
      script(tick, api) {
        if (tick === 2) {
          const engine = api.engine;
          maxHits.mace = (engine.player().equipment.weapon = BONE_MACE, [maxHitAgainst(engine, "scurrius", ["rat"]), maxHitAgainst(engine, "scurrius", [])]);
          engine.player().equipment.weapon = BONE_SHORTBOW;
          maxHits.bow = [maxHitAgainst(engine, "scurrius", ["rat"]), maxHitAgainst(engine, "scurrius", [])];
          engine.player().attackTarget = null;
        }
        scenario.script(tick, api);
      },
    },
    {
      onTick: (tick, engine) => {
        for (const event of engine.getLastTickEvents()) {
          if (event.type === "attack_started" && event.sourceId === "player" && event.targetId.startsWith("scurrius-rat")) ratShots.push(tick);
        }
      },
    },
  );
  // The flat 10 on top of whatever the rest of the formula gives.
  assert.equal(maxHits.mace[0] - maxHits.mace[1], 10, JSON.stringify(maxHits));
  assert.equal(maxHits.bow[0] - maxHits.bow[1], 10, JSON.stringify(maxHits));
  // A wave of six, each shot a tick after the last: the 3-tick bow keeps no cooldown on them.
  assert.ok(ratShots.length >= 6, ratShots.join());
  const gaps = ratShots.slice(1).map((tick, n) => tick - ratShots[n]);
  assert.ok(gaps.filter((gap) => gap === 1).length >= 5, `rat shots on ticks ${ratShots.join()}`);
});

test("against anything but a rat: no attack, and the game's words", { skip }, async () => {
  let attacks = 0;
  const messages = [];
  await runScenario(
    {
      name: "rat-bone-elsewhere",
      kind: "leviathan",
      seed: 3,
      ticks: 30, // the attack is refused within reach, as an ammunition refusal is: the bow's reach, not a melee walk
      mechanics: { infiniteHealth: true, infinitePrayer: true },
      equipment: scurriusLoadouts.mid_ranged.equipment,
      supplies: scurriusLoadouts.mid_ranged.supplies,
      script(tick, api) {
        if (tick === 1) protect(api, "ProtectMagic");
        if (tick === 2) attack(api, "leviathan");
      },
    },
    {
      onTick: (tick, engine) => {
        for (const event of engine.getLastTickEvents()) {
          if (event.type === "attack_started" && event.sourceId === "player") attacks++;
          if (event.type === "game_message") messages.push(event.segments.map(({ text }) => text).join(""));
        }
      },
    },
  );
  assert.equal(attacks, 0);
  assert.ok(messages.includes("You can only use this weapon against rats."), JSON.stringify(messages));
});
