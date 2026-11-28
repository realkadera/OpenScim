// The Leviathan's rules that recordings settled (client/encounters/leviathan/encounter.js, OBS 11/25): when each thing
// comes, what it hits and how hard, post-quest and awakened. Fights of the harness, no browser.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, runScenario } from "../tools/determinism/harness.mjs";
import { attack, castOn, meleeGear, protect, rangedGear, setBossHp } from "../tools/determinism/scenarios/common.mjs";
import { heading, isSheltered, lightningSectors, sectorOf, turnSector } from "../client/encounters/leviathan/geometry.js";

const BOSS = "leviathan";
const AWAKENED = "leviathan_awakened";
const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;
const shadow = { spellbook: "ancient", runePouch: { kind: "divine", slots: [{ id: 565 }, { id: 560 }, { id: 566 }] } };

// Runs a fight and lists what happened: { tick, ...event } of the visual events taken apart, the messages, the
// hitsplats and the player's and the NPCs' tiles after each tick.
async function fight({ kind = AWAKENED, ticks, seed = 5, script, mechanics = {}, gear = rangedGear, ...rest }) {
  const log = [];
  const at = new Map();
  let engineOf;
  await runScenario(
    { name: "leviathan-rules", kind, seed, ticks, mechanics: { infiniteHealth: true, infinitePrayer: true, infiniteStamina: true, ...mechanics }, ...gear, supplies: { ...gear.supplies, ...shadow }, inventory: [556], script, ...rest },
    {
      onTick(tick, engine) {
        engineOf = engine;
        at.set(tick, { player: [...engine.player().position], npcs: new Map([...engine.worldState.actors.values()].filter((actor) => actor.kind === "npc").map((npc) => [npc.id, [...npc.position]])) });
        for (const event of engine.getLastTickEvents()) {
          if (event.type === "game_message") log.push({ tick, message: event.segments.map(({ text }) => text).join("") });
          if (event.type === "hitsplat_spawned") log.push({ tick, hit: event.targetId, amount: event.amount });
          if (event.type === "zuk_attack") log.push({ tick, orb: event.attack });
          if (event.type !== "inferno_visual") continue;
          for (const { actorId, clipId } of event.animations) log.push({ tick, clip: clipId, actor: actorId });
          for (const { spotAnimId, target, height } of event.graphics) log.push({ tick, graphic: spotAnimId, tile: target.position, height });
          for (const { spotAnimId, target } of event.projectiles) log.push({ tick, projectile: spotAnimId, tile: target.position });
        }
      },
    },
  );
  const ticksOf = (test) => log.filter(test).map(({ tick }) => tick);
  return { log, at, ticksOf, first: (test) => ticksOf(test)[0], hitsOn: (id) => log.filter(({ hit }) => hit === id), engine: engineOf };
}
const message = (part) => (entry) => entry.message?.includes(part);
const clip = (name) => (entry) => entry.clip === name && entry.actor === BOSS;
const graphic = (id) => (entry) => entry.graphic === id;
const unique = (list) => [...new Set(list)];
const place = (api, tile) => {
  api.engine.player().position = [...tile];
  api.moveTo(...tile);
};
const state = (api) => api.engine.getEncounterSnapshot().state;
// Has the special `kind` come next, stuns it from the west and hits it from the east, where the player then is.
function wakeWith(kind) {
  let woken = false;
  return (tick, api) => {
    if (tick === 1) {
      api.engine.encounter.nextSpecial = kind;
      place(api, [24, 36]);
      castOn(api, BOSS, "Shadow Barrage");
    }
    if (woken || state(api).special) {
      woken = true;
      return true;
    }
    if (state(api).stunnedUntil !== null) {
      if (api.player().position[0] < 37) place(api, [39, 36]);
      attack(api, BOSS);
    }
    return false;
  };
}

test("geometry: the sectors, the way they turn, the tornado's heading and the line of shelter", () => {
  assert.equal(lightningSectors.length, 20);
  assert.equal(sectorOf([44, 37]), 0);
  assert.equal(sectorOf([33, 44]), 5);
  assert.equal(sectorOf([38, 34]), 18);
  assert.deepEqual([turnSector(0, 19), turnSector(19, 0), turnSector(4, 4), turnSector(3, 9)], [19, 0, 4, 4]);
  assert.deepEqual([heading(2, -11), heading(3, 2), heading(2, 1), heading(2, -1), heading(1, 2), heading(-1, 2), heading(0, 0)], [[0, -1], [1, 1], [1, 0], [1, -1], [1, 1], [0, 1], [0, 0]]);
  const rock = ([x, y]) => x === 41 && y === 31;
  assert.equal(isSheltered([42, 30], rock), true);
  assert.equal(isSheltered([42, 34], rock), false);
  assert.equal(isSheltered([41, 31], rock), false, "the rock's own tile is an end of the line");
});

for (const kind of [BOSS, AWAKENED]) {
  test(`${kind}: the lightning's stages, its strikes and the first orb after it`, { skip }, async () => {
    const wake = wakeWith("lightning");
    const run = await fight({ kind, ticks: 80, script: (tick, api) => void wake(tick, api) });
    const start = run.first(message("charges up a lightning attack"));
    assert.ok(start > 0, "no lightning");
    assert.equal(run.first(message("right in its weak spot")), start, "the two messages come together");
    assert.equal(run.first(message("stuns the Leviathan")) < start, true);
    const after = (test) => unique(run.ticksOf(test).map((tick) => tick - start).filter((tick) => tick >= 0));
    assert.deepEqual([after(clip("roar"))[0], after(clip("lightning"))[0], after(clip("lightningLoop"))[0], after(clip("lightningEnd"))[0]], [0, 3, 7, 42]);
    assert.deepEqual(after(graphic(2493)), Array.from({ length: 35 }, (_, n) => 7 + n));
    assert.equal(after((entry) => entry.orb)[0], 48);
    // Every tail answers the hit on its back.
    assert.deepEqual(unique(run.log.filter(({ clip }) => clip === "weakSpot").map(({ actor, tick }) => actor + "@" + (tick - start))), [0, 1, 2, 3, 4].map((n) => `leviathan-tail-${n}@0`));
    // The tiles of each strike are one sector's, the first one over, counter-clockwise, from the player's, who stands still:
    // then theirs, which is hit every time.
    const strikes = new Map();
    for (const { tick, tile } of run.log.filter(graphic(2503))) strikes.set(tick, [...(strikes.get(tick) ?? []), tile.join()]);
    const sectors = [...strikes.values()].map((tiles) => lightningSectors.findIndex((sector) => sector.map(String).sort().join(" ") === tiles.sort().join(" ")));
    const own = sectorOf(run.at.get(start).player);
    assert.deepEqual(sectors, [(own + 1) % 20, ...Array(34).fill(own)]);
    const hits = run.hitsOn("player").filter(({ tick }) => tick >= start + 7 && tick <= start + 41 && lightningSectors[own].some((tile) => tile.join() === run.at.get(tick - 1).player.join()));
    assert.ok(hits.length >= 34, `${hits.length} hits`);
    if (kind === AWAKENED) assert.ok(hits.every(({ amount }) => amount >= 19 && amount <= 22), hits.map(({ amount }) => amount).join());
  });

  test(`${kind}: the smoke's stages, and any rock shelters from its blast`, { skip }, async () => {
    // In the open, then behind a rock that this smoke did not throw.
    for (const sheltered of [false, true]) {
      const wake = wakeWith("smoke");
      const run = await fight({
        kind,
        ticks: 60,
        script(tick, api) {
          if (tick === 1) api.engine.encounter.rubble.set("41,42", [41, 42, 0]);
          if (!wake(tick, api)) return;
          const gone = tick - state(api).special?.start;
          if (gone >= 14 && gone <= 16) place(api, sheltered ? [42, 43] : [27, 42]);
          else if (gone >= 4) place(api, [39 + (Math.floor(gone / 2) % 2), 29]);
        },
      });
      const start = run.first(message("begins to spit out debris"));
      assert.ok(start > 0, "no smoke");
      const after = (test) => unique(run.ticksOf(test).map((tick) => tick - start).filter((tick) => tick >= 0));
      assert.deepEqual([after(clip("roar"))[0], after(clip("spit"))[0], after(clip("blast"))[0], after(clip("lightningEnd"))[0]], [0, 3, 13, 16]);
      assert.deepEqual(after((entry) => entry.projectile === 2472), Array.from({ length: 10 }, (_, n) => 4 + n));
      assert.deepEqual([after(graphic(2494))[0], after(graphic(2505))[0]], [13, 16]);
      assert.equal(after((entry) => entry.orb)[0], 24);
      const hits = run.hitsOn("player").filter(({ tick }) => tick === start + 16);
      assert.equal(hits.length, sheltered ? 0 : 1, sheltered ? "sheltered" : "in the open");
      if (kind === AWAKENED && !sheltered) assert.ok(hits[0].amount >= 70 && hits[0].amount <= 75, String(hits[0].amount));
    }
  });

  test(`${kind}: a shadow spell stuns and does no damage; its front lets 10 through, its back is half the arena`, { skip }, async () => {
    let until = null;
    const run = await fight({
      kind,
      ticks: 40,
      script(tick, api) {
        if (tick === 1) {
          place(api, [24, 36]);
          castOn(api, BOSS, "Shadow Barrage");
        }
        until ??= state(api).stunnedUntil;
        if (state(api).stunnedUntil !== null) attack(api, BOSS);
      },
    });
    const stunned = run.first(message("stuns the Leviathan"));
    assert.deepEqual(run.hitsOn(BOSS).filter(({ tick }) => tick <= stunned).map(({ amount }) => amount), [0]);
    const length = 14; // OBS 11/26, post-quest: the next orb 14 ticks after (2 of 3); awakened, as it (inferred)
    assert.equal(until - stunned, length);
    const front = run.hitsOn(BOSS).filter(({ tick }) => tick > stunned && tick < stunned + length);
    assert.ok(front.length > 0 && front.every(({ amount }) => amount <= 10), front.map(({ amount }) => amount).join());
    assert.equal(run.first(message("weak spot")), undefined);
    // Held still for its time, then an orb at once, with no special.
    assert.equal(run.first((entry) => entry.orb && entry.tick > stunned), stunned + length);
    assert.equal(run.first(message("charges up")) ?? run.first(message("spit out")), undefined);

    // From the west, a player almost level with its middle to the east of it is behind it; one to the west is not.
    for (const [from, tile, behind] of [[[24, 36], [34, 42], true], [[24, 36], [32, 42], false], [[26, 43], [41, 37], true]]) {
      const hit = await fight({
        kind,
        ticks: 14,
        script(tick, api) {
          if (tick === 1) {
            place(api, from);
            castOn(api, BOSS, "Shadow Barrage");
          }
          if (state(api).stunnedUntil !== null) {
            place(api, tile);
            attack(api, BOSS);
          }
        },
      });
      assert.equal(hit.first(message("weak spot")) !== undefined, behind, `stunned from ${from}, hit from ${tile}`);
    }
  });

  test(`${kind}: bites beside the pool: one early at most, none in the second and third volleys, some in the one-tick ones`, { skip }, async () => {
    // From the volley `volley` (0 is the first), the player beside the pool, praying `prayer` or nothing.
    const beside = (volley, seed, ticks, prayer) =>
      fight({ kind, seed, ticks, script(tick, api) {
        if (tick === 1) {
          place(api, [28, 36]);
          api.engine.encounter.volley = volley;
          if (prayer) protect(api, prayer);
        }
      } });
    // The first volley: OBS (video), OBS kills: one early bite at most, post-quest; OBS 11/25: none awakened.
    let early = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const bites = (await beside(0, seed, 22)).ticksOf(clip("bite")).length;
      assert.ok(bites <= (kind === AWAKENED ? 0 : 1), `seed ${seed}: ${bites} bites`);
      early += bites;
    }
    if (kind === BOSS) assert.ok(early > 0, "no early bite in 8 fights");
    // The second and third volleys (OBS kills: 0 of 40 turns, after a stun too).
    assert.deepEqual((await beside(1, 5, 45)).ticksOf(clip("bite")), []);
    // The one-tick ones: on some turns, the next attack 4 ticks after; it lands a tick later, and Protect from Melee
    // blocks it.
    const [least, most] = kind === AWAKENED ? [58, 86] : [34, 50];
    for (const prayer of [null, "ProtectMelee"]) {
      const run = await beside(3, 5, 40, prayer);
      const bites = run.ticksOf(clip("bite"));
      assert.ok(bites.length > 0, "no bite");
      const attacks = run.ticksOf((entry) => entry.orb);
      for (const bite of bites) {
        assert.equal(attacks.find((tick) => tick > bite), bite + 4, `after the bite at ${bite}`);
        const bitten = run.hitsOn("player").filter(({ tick, amount }) => tick === bite + 1 && amount >= least && amount <= most);
        assert.equal(bitten.length, prayer ? 0 : 1, `the bite at ${bite}`);
      }
    }
  });

  test(`${kind}: a shadow spell cast to stun it starts no attack delay, and a shot let go before the stun is not held to 10`, { skip }, async () => {
    let early = 0;
    for (const seed of [1, 2, 3]) {
      let ready = null;
      const run = await fight({ kind, seed, ticks: 8, script(tick, api) {
        if (tick === 1) {
          place(api, [24, 36]);
          castOn(api, BOSS, "Shadow Barrage");
        }
        // OBS kills: the shot the tick after the cast (20 of 23).
        if (tick === 2) ready = api.engine.combatSystem.getNextAttackTick(api.player().id) ?? 0;
        if (tick > 1 && api.player().manualCastSpell === null && api.player().attackTarget !== BOSS) attack(api, BOSS);
      } });
      assert.ok(ready <= 2, `the weapon is ready from tick ${ready}`);
      const stunned = run.first(message("stuns the Leviathan"));
      early += run.hitsOn(BOSS).filter(({ tick, amount }) => tick === stunned && amount > 10).length;
    }
    assert.ok(early > 0, "every shot let go before the stun was held to 10");
  });

  test(`${kind}: the player climbs in at 23,32, the tails answer a bite, and an orb is seen to land on a player it hurts`, { skip }, async () => {
    const impacts = [2490, 2491, 2492];
    for (const prayed of [false, true]) {
      const run = await fight({ kind, ticks: 22, script(tick, api) {
        const orb = prayed && state(api).orbs.find(({ lands }) => lands === tick);
        const wanted = orb && (orb.style === "magic" ? "ProtectMagic" : "ProtectRange");
        if (wanted && api.player().activePrayer !== wanted) protect(api, wanted);
      } });
      assert.deepEqual(run.at.get(0).player, [23, 32]);
      const landed = run.ticksOf((entry) => entry.orb).map((tick) => tick + 5).filter((tick) => tick <= 22);
      assert.ok(landed.length >= 3);
      assert.deepEqual(run.ticksOf((entry) => impacts.includes(entry.graphic)), prayed ? [] : landed);
    }
    const bitten = await fight({ kind, ticks: 24, script(tick, api) {
      if (tick === 1) {
        place(api, [28, 36]);
        api.engine.encounter.volley = 3; // a one-tick volley: it may bite on any turn
      }
    } });
    const bites = bitten.ticksOf(clip("bite"));
    assert.ok(bites.length > 0, "no bite");
    for (const n of [0, 1, 2, 3, 4]) assert.deepEqual(bitten.ticksOf((entry) => entry.clip === "bite" && entry.actor === "leviathan-tail-" + n), bites);
  });

  test(`${kind}: melee cannot reach it`, { skip }, async () => {
    const run = await fight({ kind, ticks: 12, gear: meleeGear, script(tick, api) {
      if (tick === 1) place(api, [29, 37]);
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    } });
    assert.ok(run.ticksOf(message("Your melee attacks can't reach the lure!")).length > 0);
    assert.ok(run.hitsOn(BOSS).every(({ amount }) => amount === 0));
  });
}

test("awakened: nothing lowers its levels (WIKI)", { skip }, async () => {
  for (const kind of [BOSS, AWAKENED]) {
    const defence = [];
    const full = kind === AWAKENED ? 287 : 250;
    await fight({ kind, ticks: 6, script(tick, api) {
      const { levels } = api.npcs().find(({ id }) => id === BOSS).formulaStats;
      defence.push(levels.defence);
      if (tick === 3) levels.defence = 100;
    } });
    assert.deepEqual(defence, kind === AWAKENED ? Array(6).fill(full) : [full, full, full, 100, 100, 100]);
  }
});

test("the lightning turns a sector a tick towards where the player was two ticks before", { skip }, async () => {
  const wake = wakeWith("lightning");
  const run = await fight({ ticks: 70, script(tick, api) {
    if (!wake(tick, api) || !state(api).special) return;
    const gone = tick - state(api).special.start;
    api.moveTo(38, Math.floor(gone / 5) % 2 ? 32 : 40);
    if (api.player().attackTarget !== null) attack(api, null);
  } });
  const start = run.first(message("charges up"));
  const strikes = new Map();
  for (const { tick, tile } of run.log.filter(graphic(2503))) strikes.set(tick, [...(strikes.get(tick) ?? []), tile.join()]);
  let sector = (sectorOf(run.at.get(start + 2).player) + 1) % 20;
  const seen = new Set();
  for (const [tick, tiles] of strikes) {
    if (tick > start + 7) sector = turnSector(sector, sectorOf(run.at.get(tick - 2).player));
    seen.add(sector);
    assert.deepEqual(tiles.sort(), lightningSectors[sector].map(String).sort(), `strike ${tick - start}`);
    // It throws orbs from every fourth sector alone.
    if (sector % 4 !== 0) assert.equal(run.log.some((entry) => entry.tick === tick && entry.projectile === 2506), false, `sector ${sector}`);
  }
  assert.ok(seen.size >= 5, [...seen].join());
  // Run back and forth along one side, two tiles a tick, as it was recorded: never hit.
  assert.deepEqual(run.hitsOn("player").filter(({ tick, amount }) => tick > start + 14 && tick <= start + 41 && amount > 0), []);
});

test("awakened: the volleys start again from the third after every stun", { skip }, async () => {
  const wake = wakeWith("smoke");
  const run = await fight({ ticks: 70, script: (tick, api) => {
    if (wake(tick, api) && state(api).special) place(api, [39 + (Math.floor(tick / 2) % 2), 29]);
  } });
  const start = run.first(message("begins to spit"));
  const orbs = run.ticksOf((entry) => entry.orb && entry.tick > start);
  assert.deepEqual(orbs.slice(0, 4).map((tick) => tick - start), [24, 26, 28, 30]);
});

test("awakened: the tornado at half its hitpoints, where it goes and what it does", { skip }, async () => {
  const run = await fight({
    ticks: 60,
    script(tick, api) {
      if (tick === 1) setBossHp(api, 1351);
      if (tick === 4) setBossHp(api, 1350);
      if (tick < 30) place(api, [41, 31]);
      else place(api, [28, 36]);
    },
  });
  const there = [...run.at].filter(([, { npcs }]) => npcs.has("leviathan-tornado"));
  assert.equal(there[0][0], 4, "it comes on the tick it is down to 1,350");
  assert.ok(Math.max(...there[0][1].npcs.get("leviathan-tornado").map((v, n) => Math.abs(v - [41, 31][n]))) <= 7);
  // A step a tick towards where the player was; on them it hits, and stays 7 ticks.
  const hits = run.log.filter(graphic(2507)).map(({ tick }) => tick);
  assert.ok(hits.length >= 1, "it never reached the player");
  for (let n = 1; n < there.length; n++) {
    const [tick, { npcs }] = there[n];
    const [from, to] = [there[n - 1][1].npcs.get("leviathan-tornado"), npcs.get("leviathan-tornado")];
    const player = run.at.get(tick - 1).player;
    const held = hits.some((hit) => tick >= hit && tick < hit + 7);
    const step = heading(player[0] - from[0], player[1] - from[1]);
    assert.deepEqual(to, held ? from : [from[0] + step[0], from[1] + step[1]], `tick ${tick}`);
  }
  const orbTicks = new Set(run.ticksOf((entry) => entry.orb).flatMap((tick) => [tick + 3, tick + 4, tick + 5]));
  const rockTicks = new Set([
    ...run.ticksOf((entry) => entry.graphic >= 2477 && entry.graphic <= 2480).map((tick) => tick + 7),
    ...run.ticksOf((entry) => entry.graphic === 2475 || entry.graphic === 2476).flatMap((tick) => [tick + 6, tick + 7, tick + 8]),
  ]);
  const damage = run.hitsOn("player").filter(({ tick }) => hits.includes(tick) && !orbTicks.has(tick) && !rockTicks.has(tick));
  assert.ok(damage.length > 0 && damage.every(({ amount }) => amount >= 40 && amount <= 48), damage.map(({ amount }) => amount).join());
  const none = await fight({ kind: BOSS, ticks: 20, script: (tick, api) => tick === 1 && setBossHp(api, 300) });
  assert.ok([...none.at.values()].every(({ npcs }) => !npcs.has("leviathan-tornado")));
});

test("awakened: the enrage, its pathfinder, its orbs and its rocks", { skip }, async () => {
  const wake = wakeWith("smoke");
  const run = await fight({
    ticks: 60,
    seed: 9,
    script(tick, api) {
      if (tick === 1) {
        setBossHp(api, 541);
        // Rocks two tiles from the north-west corner's middle, none nearer: the pathfinder passes it by.
        api.engine.encounter.rubble.set("25,42", [25, 42, 0]);
      }
      if (wake(tick, api)) place(api, state(api).rubble.length > 5 ? [40, 30] : [40, 41]);
    },
  });
  const hit = run.first(message("begins to spit out debris"));
  const after = (test) => unique(run.ticksOf(test).map((tick) => tick - hit).filter((tick) => tick >= 0));
  assert.equal(after((entry) => entry.projectile === 2472).length, 0, "the smoke stops before its first rock");
  assert.deepEqual(after(message("focuses on you intensely")), [4]);
  assert.deepEqual(after(clip("orbEnd")), [1]);
  assert.deepEqual(after(clip("roar")), [0, 2]);
  assert.deepEqual(after(graphic(2298)), [1]);
  // A plus of rocks that stay where the player stands, loose ones besides; the next 8 ticks on, then every 10.
  const waves = after((entry) => entry.graphic >= 2477 && entry.graphic <= 2480);
  assert.deepEqual(waves, [1, 9, 19, 29, 39, 49].slice(0, waves.length));
  assert.ok(waves.length >= 4);
  const second = run.log.filter((entry) => entry.tick === hit + 9 && entry.graphic >= 2477 && entry.graphic <= 2480).map(({ tile }) => tile.join());
  assert.deepEqual(second.sort(), ["39,30", "40,29", "40,30", "40,31", "41,30"]);
  assert.ok(run.log.filter((entry) => entry.tick === hit + 9 && (entry.graphic === 2475 || entry.graphic === 2476)).length > 5);
  // An orb a tick from 7 ticks after the hit, its startup the first one's alone.
  const orbs = run.ticksOf((entry) => entry.orb && entry.tick > hit).map((tick) => tick - hit);
  assert.deepEqual(orbs.slice(0, 5), [7, 8, 9, 10, 11]);
  assert.deepEqual(after(clip("orbStart")), [7]);
  // The pathfinder, in the north-east, a step a tick from 7 ticks after the hit.
  assert.equal(run.at.get(hit + 3).npcs.has("abyssal-pathfinder"), false);
  assert.deepEqual([4, 6, 7, 8].map((gone) => run.at.get(hit + gone).npcs.get("abyssal-pathfinder")), [[38, 41], [38, 41], [38, 40], [38, 39]]);
});

test("awakened: an orb goes through the right prayer three tiles from the pathfinder's middle, not two", { skip }, async () => {
  // Beside it by so many tiles; then 2 behind it, where its next step, which counts, leaves the player 3 away.
  for (const [away, behind, hurt] of [[2, 0, false], [3, 0, true], [0, 2, true], [0, 1, false]]) {
    const run = await fight({
      ticks: 60,
      seed: 9,
      script(tick, api) {
        if (tick === 1) setBossHp(api, 500);
        const { orbs } = state(api);
        const orb = orbs.find(({ lands }) => lands === tick);
        const wanted = orb && (orb.style === "magic" ? "ProtectMagic" : "ProtectRange");
        if (wanted && api.player().activePrayer !== wanted) protect(api, wanted);
        const pathfinder = api.npcs().find((npc) => npc.id === "abyssal-pathfinder");
        // East of the side it walks down or north of the one it walks along, so many tiles from where it steps to.
        if (!pathfinder) return place(api, [40, 44]);
        const [x, y] = [pathfinder.position[0] + 1, pathfinder.position[1] + 1];
        place(api, y === 42 ? [x - behind, y + away] : [x + away, y + behind]);
      },
    });
    const enraged = run.first(message("focuses on you"));
    const orbTicks = new Set(run.ticksOf((entry) => entry.orb).map((tick) => tick + 3));
    // From the north-west along the north side: the player north of its middle, the same column.
    const along = [...run.at].filter(([tick, { npcs }]) => tick > enraged + 4 && tick < enraged + 12 && orbTicks.has(tick) && npcs.get("abyssal-pathfinder")?.[1] === 41).map(([tick]) => tick);
    assert.ok(along.length >= 4, "no orbs along the north side");
    const impacts = along.filter((tick) => run.log.some((entry) => entry.tick === tick && (entry.graphic === 2490 || entry.graphic === 2492)));
    assert.equal(impacts.length > 0, hurt, `${away} beside, ${behind} behind: ${impacts.length} of ${along.length} went through`);
  }
});

// Prays against each orb as it lands.
function prayAgainstOrbs(api, tick) {
  const orb = state(api).orbs.find(({ lands }) => lands === tick);
  const wanted = orb && (orb.style === "magic" ? "ProtectMagic" : "ProtectRange");
  if (wanted && api.player().activePrayer !== wanted) protect(api, wanted);
}

test("post-quest: after a one-tick volley its end, the roar a tick later; the chip a tick after the rocks, loose ones with them", { skip }, async () => {
  const run = await fight({ kind: BOSS, ticks: 24, script(tick, api) {
    if (tick === 1) api.engine.encounter.volley = 3;
    prayAgainstOrbs(api, tick);
  } });
  const end = run.first(clip("orbEnd"));
  const last = Math.max(...run.ticksOf((entry) => entry.orb).filter((tick) => tick < end));
  // OBS kills: its end a tick after the last orb, the roar a tick after that (46 of 46).
  assert.deepEqual([end, run.first(clip("roar"))], [last + 1, last + 2]);
  assert.deepEqual(unique(run.ticksOf((entry) => entry.graphic >= 2477 && entry.graphic <= 2480)), [end]);
  assert.ok(run.ticksOf((entry) => entry.graphic === 2475 || entry.graphic === 2476).filter((tick) => tick === end).length > 3, "few loose rocks");
  // Each rock is drawn up off the tile's height, or the Scar's floor covers its shadow (encounter.js, rockLift).
  assert.deepEqual(unique(run.log.filter((entry) => entry.graphic >= 2475 && entry.graphic <= 2480).map(({ height }) => height)), [8]);
  // OBS kills: 4 to 7, a tick after the rocks (168 of 168).
  const chip = run.hitsOn("player").filter(({ tick, amount }) => amount > 0 && tick < end + 7); // before its rock lands
  assert.equal(chip.length, 1, chip.map(({ tick, amount }) => `${amount} at ${tick}`).join());
  assert.equal(chip[0].tick, end + 1);
  assert.ok(chip[0].amount >= 4 && chip[0].amount <= 7, String(chip[0].amount));
});

test("post-quest: enraged, a rock on the player 8 ticks after the enrage's, then every 10", { skip }, async () => {
  const run = await fight({ kind: BOSS, ticks: 45, script(tick, api) {
    if (tick === 1) setBossHp(api, 180);
    prayAgainstOrbs(api, tick);
  } });
  const waves = unique(run.ticksOf((entry) => entry.graphic >= 2477 && entry.graphic <= 2480));
  assert.deepEqual(waves.map((tick) => tick - waves[0]), [0, 8, 18, 28, 38].slice(0, waves.length));
  assert.ok(waves.length >= 4, waves.join());
});

test("post-quest: a rock that lands on the player puts them a tile south-west, or north-west where that is shut", { skip }, async () => {
  // OBS 11/25, OBS 11/26: from 25,36 to 24,35; from 28,26, where south-west, west and south are no floor, to 27,27.
  for (const [from, to] of [[[25, 36], [24, 35]], [[28, 26], [27, 27]]]) {
    const run = await fight({ kind: BOSS, ticks: 34, script(tick, api) {
      if (tick === 1) {
        api.engine.encounter.nextSpecial = "smoke"; // its tells far from these tiles
        api.engine.player().position = [...from]; // standing, with nowhere to walk back to
      }
      prayAgainstOrbs(api, tick);
    } });
    const roar = run.first(clip("roar"));
    const lands = roar + 7;
    assert.deepEqual([run.at.get(lands - 1).player, run.at.get(lands).player, run.at.get(lands + 1).player], [from, to, to]);
    const hit = run.hitsOn("player").filter(({ tick, amount }) => tick === lands && amount > 0);
    assert.ok(hit.length === 1 && hit[0].amount >= 19 && hit[0].amount <= 25, hit.map(({ amount }) => amount).join());
  }
});

test("post-quest: after the third stun the volleys start again from the third, not the fourth", { skip }, async () => {
  const wake = wakeWith("smoke");
  let after = null;
  await fight({ kind: BOSS, ticks: 50, script(tick, api) {
    if (tick === 1) api.engine.encounter.stuns = 2;
    if (wake(tick, api) && state(api).special) after = state(api).volley;
  } });
  assert.equal(after, 3); // OBS 11/26: the second, the third, the third
});

test("awakened: its first volley is the post-quest second, 2 ticks apart", { skip }, async () => {
  const run = await fight({ kind: AWAKENED, ticks: 16, script: (tick, api) => prayAgainstOrbs(api, tick) });
  const orbs = run.ticksOf((entry) => entry.orb);
  assert.deepEqual(orbs.slice(1, 5).map((tick, n) => tick - orbs[n]), [2, 2, 2, 2]); // OBS 11/26
});

test("post-quest: a stun that runs out goes on with the volley, and does not count towards the next one broken", { skip }, async () => {
  // OBS 11/26: a stun run out in the third volley, its orbs going on to 8; then a stun broken: the second volley after it.
  let woken = false;
  let broken = false;
  let after = null;
  const run = await fight({ kind: BOSS, ticks: 120, script(tick, api) {
    if (tick === 1) {
      api.engine.encounter.volley = 2;
      api.engine.encounter.nextSpecial = "smoke";
      place(api, [24, 36]);
      castOn(api, BOSS, "Shadow Barrage");
    }
    const s = state(api);
    if (!woken && s.stunnedUntil === null && api.engine.encounter.stuns === 0 && tick > 25) {
      woken = true; // it ran out: stun it again, and break this one from behind
      castOn(api, BOSS, "Shadow Barrage");
    }
    if (woken && s.stunnedUntil !== null && !broken) {
      if (api.player().position[0] < 37) place(api, [39, 36]);
      attack(api, BOSS);
    }
    if (s.special) broken = true;
    if (broken && !s.special && after === null && tick > 40) after = s.volley;
  } });
  const first = run.first(message("stuns the Leviathan"));
  const orbs = run.ticksOf((entry) => entry.orb && entry.tick > first && entry.tick < first + 30);
  assert.deepEqual(orbs.slice(0, 2).map((tick) => tick - first), [14, 16], "the third volley goes on, 2 ticks apart");
  assert.equal(after, 2, "the second volley after the first stun broken");
});

test("post-quest: the rocks stay through its death and crumble as it goes", { skip }, async () => {
  // OBS 11/26 kills (21 of 21): every rock stays to its removal, 6 ticks after the kill, and then crumbles (2474).
  let killed = null;
  const rubbleAt = new Map();
  const run = await fight({ kind: BOSS, ticks: 20, script(tick, api) {
    if (tick === 1) for (const [x, y] of [[25, 42], [40, 30]]) api.engine.encounter.rubble.set(`${x},${y}`, [x, y, 0]);
    if (tick === 3) setBossHp(api, 0);
    rubbleAt.set(tick, state(api).rubble.length);
    if (killed === null && api.engine.getEncounterOutcome().phase !== "active") killed = tick;
  } });
  assert.notEqual(killed, null, "it was killed");
  for (let tick = killed; tick < killed + 5; tick++) assert.equal(rubbleAt.get(tick), 2, `tick ${tick}: the rocks are still there`);
  const crumbled = run.log.filter(graphic(2474));
  assert.deepEqual(unique(crumbled.map(({ tick }) => tick)).length, 1);
  assert.deepEqual(crumbled.map(({ tile }) => tile.join()).sort(), ["25,42", "40,30"]);
  assert.equal(run.engine.getEncounterSnapshot().state.rubble.length, 0);
  assert.equal(run.engine.getEncounterOutcome().phase, "victory");
});
