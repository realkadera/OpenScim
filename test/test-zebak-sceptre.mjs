import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const code = await response.text();
    assert.ok(code.includes(marker));
    await route.fulfill({
      response,
      body: code.replace(
        marker,
        marker + "if (this.encounter.kind === 'zebak') window.engine = this;",
      ),
    });
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  const result = await page.evaluate(() => {
    const player = engine.player();
    const boss = engine.worldState.actors.get("zebak");
    const strikes = [];
    const emit = engine.tickEvents.emit.bind(engine.tickEvents);
    engine.tickEvents.emit = (event) => {
      if (event.type === "attack_started" && event.sourceId === "player")
        strikes.push({ ...event, tick: engine.worldState.tick });
      return emit(event);
    };
    engine.setMechanicsConfig({
      ...engine.mechanicsConfig,
      infiniteHealth: true,
      infiniteSpecialAttack: false,
    });
    const slot = player.inventory.findIndex((item) => item?.id === 27665);
    // Isolate weapon behavior from changes to the encounter's default preset.
    if (slot < 0) player.inventory[0] = { id: 27665 };
    engine.queueEquipFromInventory(Math.max(0, slot), 27665, "weapon");
    engine.advanceTick(player.position);
    const equipment = { ...player.equipment };
    const tick = () => engine.advanceTick(player.position);
    // Deterministic accuracy lets both casts exercise the actual impact & drain path.
    boss.formulaStats.alwaysAccuratePlayerHit = true;
    engine.queueAttackTarget("zebak");
    for (let i = 0; i < 12 && strikes.length < 2; i++) tick();
    const initial = { ...boss.debuffs };
    engine.queueSpecialAttackToggle();
    for (let i = 0; i < 14 && !(boss.debuffs?.magicDrain > 0); i++) tick();
    const first = {
      energy: player.specialAttack.energy,
      drains: { ...boss.debuffs },
    };
    engine.queueSpecialAttackToggle();
    for (let i = 0; i < 12; i++) tick();
    return {
      equipment,
      initial,
      first,
      final: { energy: player.specialAttack.energy, drains: boss.debuffs },
      stats: boss.formulaStats.levels,
      strikes,
    };
  });
  const assets = await page.evaluate(async () => {
    const { CacheManager: Cache } = await import("/assets/player.js");
    const cache = new Cache();
    await cache.ensureCache();

    const graphics = [2128, 2337, 2338, 2339].map((id) => {
      const def = cache.spotAnimTypeLoader.load(id);
      return {
        id,
        model: def.modelId,
        present: !!cache.getModelLoader().getModel(def.modelId),
        seq: def.sequenceId,
      };
    });
    const weapons = [27291, 27665].map((id) => {
      const def = cache.objTypeLoader.load(id);
      return {
        id,
        models: [def.inventoryModel, def.maleModel0, def.femaleModel0].map(
          (model) => [model, !!cache.getModelLoader().getModel(model)],
        ),
      };
    });
    return {
      graphics,
      weapons,
      sequences: [
        1167,
        9961,
        9544,
        ...new Set(
          graphics.map((graphic) => graphic.seq).filter((id) => id >= 0),
        ),
      ].map((id) => {
        const seq = cache.animationSystem.loadSeqType(id);
        return {
          id,
          frames: seq.frameIds?.length ?? 0,
          groups: [
            ...new Set((seq.frameIds ?? []).map((frame) => frame >>> 16)),
          ],
          skeletal: seq.skeletalId,
          bases: [
            ...new Set(
              (seq.frameIds ?? []).map((frame) => {
                const data = cache.cacheSystem
                  .getIndex(0)
                  .Lg(frame >>> 16)
                  .getFile(frame & 0xffff).data;
                return (data[0] << 8) | data[1];
              }),
            ),
          ].map((base) => [
            base,
            !!cache.cacheSystem.getIndex(1).read(base)?.length,
          ]),
          present:
            seq.skeletalId >= 0
              ? !!cache.animationSystem.loadSkeletalSeq(seq.skeletalId)
              : (seq.frameIds ?? []).every(
                  (frame) =>
                    !!cache.cacheSystem.getIndex(0).read(frame >>> 16)?.length,
                ),
        };
      }),
    };
  });

  assert.ok(
    assets.weapons.every((weapon) =>
      weapon.models.every(([, present]) => present),
    ),
  );
  assert.ok(
    assets.sequences.every((seq) => seq.bases.every(([, present]) => present)),
  );
  assert.ok(assets.graphics.every((graphic) => graphic.present));
  assert.ok(
    assets.sequences.every(
      (seq) => seq.present && (seq.frames || seq.skeletal >= 0),
    ),
  );
  assert.equal(result.equipment.weapon, 27665);
  assert.equal(result.strikes[1].tick - result.strikes[0].tick, 4);
  assert.equal(result.strikes.filter((s) => s.usingSpecialAttack).length, 2);
  assert.ok(
    result.strikes.every((s) => s.weaponId === 27665 && s.style === "magic"),
  );
  assert.equal(result.first.energy, 50);
  assert.equal(result.final.energy, 0);
  for (const stat of ["magic", "defence"]) {
    const expected = Math.floor(result.stats[stat] * 0.15);
    assert.equal(result.initial[stat + "Drain"] ?? 0, 0);
    assert.equal(result.first.drains[stat + "Drain"], expected);
    assert.equal(result.final.drains[stat + "Drain"], expected);
  }
  console.log(
    "Charged sceptre cadence, Condemn cost and drains, and weapon cache assets passed.",
  );
} finally {
  await browser.close();
}
