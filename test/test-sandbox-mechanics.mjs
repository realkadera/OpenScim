// What the sandbox's monsters do besides attacking (client/encounters/sandbox/
// brawler.js and encounter.js, from each one's own fight): Jad's healers come
// below half his hitpoints and heal him until hit, and a monster fighting him
// goes for them first; Zuk calls Jad and his own healers; the blob attacks
// with a style the prayer does not cover and splits as it dies; the mager
// brings back the dead of its side; the meleer digs when it cannot reach;
// Vardorvis heals off his hits. Plain Node with the harness's module hooks.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
const { sandboxVariantKind } = await import("../client/encounters/sandbox/arenas.js");
const kind = sandboxVariantKind("colosseum");
await prepareArena(kind);

// The encounter draws its own seed from Math.random (as the harness says):
// a seeded one, the same for every run, keeps each run the same.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = seededRandom(17);

function run(scenario, ticks, { prayer, each } = {}) {
  Math.random = seededRandom(17);
  const engine = engineModule.createSimulationEngine({
    encounterConfig: { kind, mechanics: { infiniteHealth: true }, options: { scenario: { arena: "colosseum", meta: { name: "Test" }, ...scenario } } },
    objTypeLoader, combatSeed: 9,
    inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
  });
  if (prayer) engine.setProtectionPrayer(prayer);
  const heals = [];
  const clips = [];
  for (let step = 0; step < ticks; step++) {
    engine.advanceTick(engine.getState().playerPosition);
    for (const event of engine.getLastTickEvents()) {
      if (event.type === "hitsplat_spawned" && event.hitsplatType === "heal") heals.push(event);
      if (event.type === "inferno_visual") for (const animation of event.animations ?? []) clips.push({ tick: engine.currentTick, ...animation });
    }
    each?.(engine);
  }
  return { engine, heals, clips, npcs: () => engine.worldState.getNpcs() };
}
const spectating = { mode: "ffa", options: { ffaIncludesPlayer: false } };

// Jad below half: five healers, who heal him; the jaguars fighting him go for a healer that heals.
{
  const targets = new Set();
  const { heals, npcs } = run({
    ...spectating,
    npcs: [
      { id: "jad", npc: "inferno.jad", position: [24, 34], hp: 200, team: "2" },
      { id: "jag1", npc: "colosseum.jaguar", position: [32, 34], team: "1" },
      { id: "jag2", npc: "colosseum.jaguar", position: [32, 38], team: "1" },
    ],
  }, 80, { each: (engine) => { for (const id of ["jag1", "jag2"]) targets.add(engine.worldState.getNpc(id)?.combat.targetId); } });
  const healers = npcs().filter((npc) => npc.npcTypeId === 7701 || npc.id.startsWith("jad_healer"));
  assert.ok(healers.length > 0 || [...targets].some((id) => id?.startsWith("jad_healer")), "Jad's healers come below half his hitpoints");
  assert.ok(heals.some((heal) => heal.targetId === "jad" && heal.amount === 10), "a healer heals Jad 10");
  assert.ok([...targets].some((id) => id?.startsWith("jad_healer")), "a monster fighting Jad goes for his healers");
}

// Zuk: Jad below 40 % of his hitpoints, his four healers below 20 %, who heal him.
{
  const { heals, npcs } = run({
    ...spectating,
    npcs: [
      { id: "zuk", npc: "inferno.zuk", position: [22, 34], hp: 300, team: "2" },
      { id: "jag", npc: "colosseum.jaguar", position: [31, 35], team: "1", hp: 4000 },
      { id: "jag2", npc: "colosseum.jaguar", position: [31, 40], team: "1", hp: 4000 },
    ],
  }, 60);
  assert.ok(npcs().some((npc) => npc.id.startsWith("jad-")), "Zuk calls Jad");
  assert.ok(heals.some((heal) => heal.targetId === "zuk" && heal.amount >= 15 && heal.amount <= 24), "Zuk's healers heal him 15 to 24");
}

// The blob, against Protect from Magic, never attacks with magic.
{
  const { engine } = run({ mode: "versus", npcs: [{ id: "blob", npc: "inferno.blob", position: [27, 31] }] }, 60, { prayer: "ProtectMagic" });
  const styles = engine.getState().damageHistory.filter((hit) => hit.targetId === "player").map((hit) => hit.attackType);
  assert.ok(styles.length >= 4, `the blob attacks (${styles.length})`);
  assert.ok(!styles.includes("magic"), `no magic through Protect from Magic (${styles})`);
}
// The blob splits in three as it dies.
{
  const spawned = new Set();
  run({ ...spectating, npcs: [{ id: "blob", npc: "inferno.blob", position: [27, 31], hp: 3, team: "1" }, { id: "jag", npc: "colosseum.jaguar", position: [31, 31], team: "2", hp: 3000 }] }, 20,
    { each: (engine) => { for (const npc of engine.worldState.getNpcs()) if (npc.id.startsWith("blob_")) spawned.add(npc.npcTypeId); } });
  assert.deepEqual([...spawned].sort(), [7694, 7695, 7696], "its three children");
}

// The mager brings back the dead bat of its side, at half its hitpoints and one.
{
  const { npcs, clips } = run({
    ...spectating,
    npcs: [
      { id: "mager", npc: "inferno.mager", position: [22, 30], team: "2", hp: 5000 },
      { id: "bat", npc: "inferno.bat", position: [30, 34], team: "2", hp: 1 },
      { id: "jag", npc: "colosseum.jaguar", position: [32, 34], team: "1", hp: 5000 },
    ],
  }, 160);
  assert.ok(clips.some((clip) => clip.actorId === "mager" && clip.clipId === "resurrect"), "the mager casts its revive");
  const bat = npcs().find((npc) => npc.id.startsWith("bat-"));
  assert.ok(bat, "the bat is back");
  assert.ok(bat.state.revived, "never to be brought back again");
}

// The meleer behind a wall digs and comes up on the other side.
{
  const wall = [];
  for (let x = 18; x <= 36; x++) wall.push([x, 37]);
  const { engine, clips } = run({ mode: "versus", obstacles: wall, npcs: [{ id: "meleer", npc: "inferno.meleer", position: [26, 40] }] }, 70);
  assert.ok(clips.some((clip) => clip.clipId === "dig_down") && clips.some((clip) => clip.clipId === "dig_up"), "it digs down and up");
  assert.ok(engine.worldState.getNpc("meleer").position[1] < 37, "it comes up on the player's side");
}

// A monster that does not dig finds no way round: the jaguar behind the same
// wall walks up to it and stays there, as in its own fight.
{
  const wall = [];
  for (let x = 18; x <= 36; x++) wall.push([x, 37]);
  const positions = [];
  const { engine } = run({ mode: "versus", obstacles: wall, npcs: [{ id: "jaguar", npc: "colosseum.jaguar", position: [26, 40] }] }, 70, {
    each: (engine) => positions.push([...engine.worldState.getNpc("jaguar").position]),
  });
  assert.ok(engine.getState().playerPosition[1] < 37, "the player is on the other side");
  assert.ok(positions.every(([, y]) => y > 37), "it never comes to the player's side");
  assert.deepEqual(positions.slice(-30), Array.from({ length: 30 }, () => positions.at(-1)), "it stands still at the wall");
}

// Vardorvis heals half of what he deals, to the player and to a monster.
{
  const { heals } = run({ mode: "versus", npcs: [{ id: "vard", npc: "vardorvis", position: [27, 33] }] }, 40, {
    each: (engine) => { const vard = engine.worldState.getNpc("vard"); if (engine.currentTick === 1) vard.vitals = { ...vard.vitals, hp: 500 }; },
  });
  assert.ok(heals.some((heal) => heal.targetId === "vard"), "he heals off his hits on the player, with a heal hitsplat");
  const onMonster = run({ ...spectating, npcs: [{ id: "vard", npc: "vardorvis", position: [27, 33], team: "1" }, { id: "jag", npc: "colosseum.jaguar", position: [31, 33], team: "2", hp: 3000 }] }, 30);
  assert.ok(onMonster.heals.some((heal) => heal.targetId === "vard"), "and on a monster");
}

// The arena's boss in a free-for-all, on a team (encounter.js, bossTeam):
// each host's boss (Duke Sucellus and Vardorvis woken at the start) fights a
// jaguar of another team with its own attacks, and leaves the player, who
// watches, alone.
{
  const { sandboxArenas } = await import("../client/encounters/sandbox/arenas.js");
  const jaguarAt = {
    sol_heredit: [28, 30], yama: [26, 33], zebak: [27, 36], vardorvis: [36, 22],
    doom: [26, 26], doom_deep: [26, 27], duke: [27, 46], leviathan: [25, 30],
    araxxor: [56, 20], maggot_king: [27, 34], corrupted_hunllef: [52, 52],
    alchemical_hydra: [13, 18], phosanis_nightmare: [29, 27],
  };
  for (const arena of sandboxArenas.filter((candidate) => candidate.hostKind)) {
    const arenaKind = sandboxVariantKind(arena.id);
    await prepareArena(arenaKind);
    Math.random = seededRandom(17);
    const engine = engineModule.createSimulationEngine({
      encounterConfig: {
        kind: arenaKind, mechanics: { infiniteHealth: true },
        options: { scenario: { arena: arena.id, mode: "ffa", meta: { name: "Test" }, options: { bossMechanics: true, ffaIncludesPlayer: false, bossTeam: "1" }, npcs: [{ id: "jag", npc: "colosseum.jaguar", position: jaguarAt[arena.id], team: "2", hp: 3000, maxHit: 1 }] } },
      },
      objTypeLoader, combatSeed: 9,
      inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
    });
    for (let step = 0; step < 150; step++) engine.advanceTick(engine.getState().playerPosition);
    assert.ok(engine.worldState.getNpc("jag").vitals.hp < 3000, `${arena.id}: the boss hurts the jaguar`);
    assert.equal(engine.getState().damageHistory.filter((hit) => hit.targetId === "player").length, 0, `${arena.id}: and not the player`);
  }
}

// The bosses placed as monsters, out of their own rooms (each encounter's sandbox.js),
// in the Colosseum again after the hosts' arenas above.
await prepareArena(kind);
{
  // The Corrupted Hunllef: four of a style then the other, a prayer that six
  // hits of another style switch (its form with it), and tornadoes that hurt.
  const forms = new Set();
  const styles = [];
  const { clips, npcs } = run({
    ...spectating,
    npcs: [
      { id: "h", npc: "corrupted_hunllef", position: [24, 30], team: "1" },
      { id: "j1", npc: "colosseum.jaguar", position: [32, 30], team: "2", hp: 3000 },
      // A caster too: hits of two styles, whichever its prayer starts on.
      { id: "s", npc: "colosseum.shaman", position: [32, 36], team: "2", hp: 3000 },
    ],
  }, 140, { each: (engine) => {
    const h = engine.worldState.getNpc("h");
    forms.add(`${h.state.protection}:${h.npcTypeId}`);
    for (const event of engine.getLastTickEvents()) if (event.type === "inferno_visual" && event.animations?.some((a) => a.actorId === "h" && a.clipId === "attack")) styles.push(h.combat.attackStyle);
  } });
  assert.ok(clips.some((clip) => clip.clipId === "switchMagic") && clips.some((clip) => clip.clipId === "switchRange"), "the Hunllef switches its style");
  assert.deepEqual(styles.slice(0, 8), ["range", "range", "range", "range", "magic", "magic", "magic", "magic"], "four of a style, then four of the other");
  assert.ok(forms.size > 1 && [...forms].every((form) => ({ melee: "9035", range: "9036", magic: "9037" })[form.split(":")[0]] === form.split(":")[1]), `its prayer switches, its form with it (${[...forms]})`);
  assert.ok(clips.some((clip) => clip.clipId === "tornado"), "it calls tornadoes");
  assert.ok(npcs().some((npc) => npc.npcTypeId === 9039), "the tornadoes come");
}
{
  // Zebak never moves, his tail plays his clips, and below a quarter he enrages.
  const { clips, npcs } = run({ ...spectating, npcs: [{ id: "z", npc: "zebak", position: [22, 28], team: "1", hp: 300 }, { id: "j", npc: "colosseum.jaguar", position: [34, 32], team: "2", hp: 3000 }] }, 100);
  const zebak = npcs().find((npc) => npc.id === "z");
  assert.deepEqual(zebak.position, [22, 28], "Zebak stays where he stands");
  assert.ok(clips.some((clip) => clip.actorId === "z~tail" && clip.clipId === "attack"), "his tail plays his clips");
  assert.equal(zebak.npcTypeId, 11732, "enraged below a quarter");
}
{
  // The Leviathan and Duke Sucellus never move.
  for (const [type, id] of [["leviathan", "l"], ["duke_sucellus", "d"]]) {
    const { npcs } = run({ ...spectating, npcs: [{ id, npc: type, position: [22, 28], team: "1" }, { id: "j", npc: "colosseum.jaguar", position: [34, 32], team: "2", hp: 3000 }] }, 40);
    assert.deepEqual(npcs().find((npc) => npc.id === id).position, [22, 28], `${type} stays where it stands`);
    assert.ok(npcs().find((npc) => npc.id === "j").vitals.hp < 3000, `${type} hurts what comes near`);
  }
}
{
  // Araxxor's araxytes come by the clock.
  const { npcs } = run({ ...spectating, npcs: [{ id: "a", npc: "araxxor", position: [22, 28], team: "1", hp: 3000 }, { id: "j", npc: "colosseum.jaguar", position: [34, 32], team: "2", hp: 9000 }] }, 120);
  assert.ok(npcs().some((npc) => npc.id.startsWith("acidic-")) && npcs().some((npc) => npc.id.startsWith("mirrorback-")), "araxytes come beside Araxxor");
}
{
  // The Ruptura lights its fuse beside its target and blows up: 64 a tile away.
  const { npcs } = run({ ...spectating, npcs: [{ id: "r", npc: "araxxor.ruptura", position: [24, 30], team: "1" }, { id: "j", npc: "colosseum.jaguar", position: [30, 30], team: "2", hp: 3000, maxHit: 0 }] }, 20);
  assert.equal(npcs().find((npc) => npc.id === "j").vitals.hp, 3000 - 64, "64 to what stands beside it (80 under it: araxxor/encounter.js)");
}
{
  // The Maggot King screeches; below 85% a larva comes, which leeches and
  // heals him; the jaguar fighting him turns on the larva as it comes.
  const larvae = new Set();
  const onLarva = new Set();
  const { clips, heals } = run({ ...spectating, npcs: [{ id: "k", npc: "maggot_king", position: [22, 28], team: "1", hp: 1000 }, { id: "j", npc: "colosseum.jaguar", position: [34, 32], team: "2", hp: 9000, maxHit: 0 }] }, 120, {
    // The jaguar hits nothing, so that the larvae live to leech: the King starts below 85%.
    each: (engine) => {
      const king = engine.worldState.getNpc("k");
      if (engine.currentTick === 1) king.vitals = { ...king.vitals, hp: 800 };
      for (const npc of engine.worldState.getNpcs()) if (npc.npcTypeId === 15743 && npc.alive) larvae.add(npc.id);
      const target = engine.worldState.getNpc("j")?.combat.targetId;
      if (larvae.has(target)) onLarva.add(target);
    },
  });
  assert.ok(clips.some((clip) => clip.actorId === "k" && clip.clipId === "screech"), "he screeches");
  assert.ok(larvae.size > 0, "a larva comes");
  assert.ok(heals.some((heal) => heal.targetId === "k"), "its leech heals him");
  assert.deepEqual([...onLarva].sort(), [...larvae].sort(), "the jaguar goes for every larva that heals him");
}

{
  // The Maggot King keeps away and spits; hurt below two thirds he comes in
  // and slams beside his target, with his "Nearby" stats.
  const { clips, npcs } = run({ ...spectating, npcs: [{ id: "k", npc: "maggot_king", position: [20, 28], team: "1", hp: 1500 }, { id: "j", npc: "colosseum.jaguar", position: [40, 32], team: "2", hp: 9000, levels: { strength: 400, attack: 400 } }] }, 200, {
    each: (engine) => { const k = engine.worldState.getNpc("k"); if (engine.currentTick === 1) k.vitals = { ...k.vitals, hp: 1010 }; },
  });
  const king = npcs().find((npc) => npc.id === "k");
  assert.ok(king.state.closedIn && king.combat.attackRange === 1, "below two thirds he comes in");
  assert.ok(clips.some((clip) => clip.actorId === "k" && clip.clipId === "slam"), "and slams");
}

{
  // The Alchemical Hydra: three of a style then the other, and a new form
  // below each quarter of its hitpoints, with that form's NPC.
  const forms = [];
  const styles = [];
  run({ ...spectating, npcs: [{ id: "h", npc: "alchemical_hydra", position: [20, 28], team: "1", hp: 1100 }, { id: "j", npc: "colosseum.jaguar", position: [34, 30], team: "2", hp: 99000, maxHit: 0 }] }, 80, {
    each: (engine) => {
      const hydra = engine.worldState.getNpc("h");
      if (engine.currentTick === 40) hydra.vitals = { ...hydra.vitals, hp: 600 };
      if (forms.at(-1) !== hydra.npcTypeId) forms.push(hydra.npcTypeId);
      for (const event of engine.getLastTickEvents()) if (event.type === "inferno_visual") for (const a of event.animations ?? []) if (a.actorId === "h" && (a.clipId === "range" || a.clipId === "magic")) styles.push(a.clipId);
    },
  });
  assert.deepEqual(styles.slice(0, 6), ["range", "range", "range", "magic", "magic", "magic"], "three of a style, then the other");
  // Its hitpoints set to 600 are not a hit: the next hit on it (the jaguar's 0s are hits) makes the form.
  run({ ...spectating, npcs: [{ id: "h", npc: "alchemical_hydra", position: [20, 28], team: "1", hp: 1100 }, { id: "j", npc: "colosseum.jaguar", position: [26, 30], team: "2", hp: 99000, maxHit: 1, levels: { attack: 999 } }] }, 60, {
    each: (engine) => {
      const hydra = engine.worldState.getNpc("h");
      if (engine.currentTick === 2) hydra.vitals = { ...hydra.vitals, hp: 560 };
      if (forms.at(-1) !== hydra.npcTypeId) forms.push(hydra.npcTypeId);
    },
  });
  assert.ok(forms.includes(8619) && forms.includes(8620), "below three quarters it is electric, below half flame (alchemical-hydra/ids.js)");
}

// A monster whose straight walk the room blocks (a tree of Vardorvis'
// clearing) goes round it; a boulder still holds it (the wall above).
{
  const arenaKind = sandboxVariantKind("vardorvis");
  await prepareArena(arenaKind);
  Math.random = seededRandom(17);
  const engine = engineModule.createSimulationEngine({
    encounterConfig: { kind: arenaKind, mechanics: { infiniteHealth: true }, options: { scenario: { arena: "vardorvis", mode: "versus", meta: { name: "Test" }, npcs: [{ id: "jag", npc: "colosseum.jaguar", position: [47, 24], hp: 3000 }] } } },
    objTypeLoader, combatSeed: 9,
    inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
  });
  for (let step = 0; step < 80; step++) engine.advanceTick(engine.getState().playerPosition);
  assert.ok(engine.getState().damageHistory.some((hit) => hit.targetId === "player" && hit.source === "Jaguar warrior"), "the jaguar comes round and attacks");
}

// The arena's boss in a free-for-all: its healers come first. The Maggot
// King's larvae (arenas.js, hostHealers) are what the archers shoot as they come.
{
  const arenaKind = sandboxVariantKind("maggot_king");
  await prepareArena(arenaKind);
  Math.random = seededRandom(17);
  const engine = engineModule.createSimulationEngine({
    encounterConfig: {
      kind: arenaKind, mechanics: { infiniteHealth: true },
      options: { scenario: { arena: "maggot_king", mode: "ffa", meta: { name: "Test" }, options: { bossMechanics: true, ffaIncludesPlayer: false, bossTeam: "1" }, npcs: [
        { id: "arch", npc: "warband.archer", position: [27, 34], team: "2", hp: 3000 }, { id: "seer", npc: "warband.seer", position: [35, 34], team: "2", hp: 3000 },
      ] } },
    },
    objTypeLoader, combatSeed: 9,
    inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
  });
  const larvae = new Set();
  let onLarva = 0;
  let larvaTicks = 0;
  for (let step = 0; step < 400; step++) {
    engine.advanceTick(engine.getState().playerPosition);
    const living = engine.worldState.getNpcs().filter((npc) => npc.id.startsWith("maggot-larva") && npc.alive && !npc.state.dying);
    for (const larva of living) larvae.add(larva.id);
    if (living.length === 0) continue;
    larvaTicks++;
    if (["arch", "seer"].every((id) => living.some((larva) => larva.id === engine.worldState.getNpc(id).combat.targetId))) onLarva++;
  }
  assert.ok(larvae.size > 0, "his larvae come");
  assert.equal(onLarva, larvaTicks, "while one lives, both are on a larva");
}

// Phosani's Nightmare in a free-for-all: the monsters break her shield,
// charge her totems (arenas.js, hostObjectives) and her blasts come, until she is beaten.
{
  const arenaKind = sandboxVariantKind("phosanis_nightmare");
  await prepareArena(arenaKind);
  Math.random = seededRandom(17);
  const strong = { attack: 300, strength: 300, ranged: 300 };
  const engine = engineModule.createSimulationEngine({
    encounterConfig: {
      kind: arenaKind, mechanics: { infiniteHealth: true },
      options: { scenario: { arena: "phosanis_nightmare", mode: "ffa", meta: { name: "Test" }, options: { bossMechanics: true, ffaIncludesPlayer: false, bossTeam: "1" }, npcs: [
        { id: "j1", npc: "colosseum.jaguar", position: [26, 20], team: "2", hp: 99000, levels: strong },
        { id: "j2", npc: "colosseum.jaguar", position: [34, 20], team: "2", hp: 99000, levels: strong },
        { id: "a1", npc: "warband.archer", position: [30, 19], team: "2", hp: 99000, levels: strong },
      ] } },
    },
    objTypeLoader, combatSeed: 9,
    inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
  });
  const stages = new Set();
  for (let step = 0; step < 1200 && engine.encounter.getOutcome().phase === "active"; step++) {
    engine.advanceTick(engine.getState().playerPosition);
    stages.add(engine.encounter.host.stage);
  }
  for (const stage of ["shield", "totems", "blast", "dead"]) assert.ok(stages.has(stage), `her ${stage}`);
  assert.equal(engine.encounter.winner, "2", "the monsters' team wins");
}

// Where the player starts, in every arena, with and without its boss: on a
// walkable tile under no one; on the scenario's own tile when it names one;
// and with the boss, the snapshot says where the host put him (encounter.js,
// hostStart), which the editor draws as the blue P.
{
  const { sandboxArenas } = await import("../client/encounters/sandbox/arenas.js");
  const { isArenaTileWalkable } = await import("../client/engine/arena.js");
  for (const arena of sandboxArenas) {
    const arenaKind = sandboxVariantKind(arena.id);
    await prepareArena(arenaKind);
    for (const [bossMechanics, playerStart] of [[false, undefined], [Boolean(arena.hostKind), undefined], [Boolean(arena.hostKind), [arena.playerStart[0], arena.playerStart[1]]]]) {
      Math.random = seededRandom(17);
      const engine = engineModule.createSimulationEngine({
        encounterConfig: { kind: arenaKind, mechanics: { infiniteHealth: true }, options: { scenario: { arena: arena.id, mode: "versus", meta: { name: "Test" }, options: { bossMechanics, ...(playerStart ? { playerStart } : {}) }, npcs: [] } } },
        objTypeLoader, combatSeed: 9,
        inventory: engineModule.createEmptyInventory(), equipment: {}, combatSupplies: engineModule.createEmptyCombatSupplies(), attackStylePerCategory: {},
      });
      const [x, y] = engine.getState().playerPosition;
      const label = `${arena.id}${bossMechanics ? " with its boss" : ""}${playerStart ? " on the scenario's tile" : ""}`;
      assert.ok(isArenaTileWalkable(x, y), `${label}: the player starts on a walkable tile`);
      assert.ok(!engine.worldState.getNpcs().some((npc) => npc.alive && x >= npc.position[0] && x < npc.position[0] + npc.size && y >= npc.position[1] && y < npc.position[1] + npc.size), `${label}: under no one`);
      if (playerStart) assert.deepEqual([x, y], playerStart, `${label}: on it`);
      engine.advanceTick([x, y]);
      const hostStart = engine.getEncounterSnapshot().sandbox.hostStart;
      if (bossMechanics && !playerStart) assert.deepEqual(hostStart, [x, y], `${label}: the snapshot names where the host put him`);
      else assert.equal(hostStart, undefined, `${label}: no host's start`);
    }
  }
}

console.log("sandbox mechanics: Jad's and Zuk's healers, the healers first (larvae too, the host's too), the blob, the mager, the meleer, Vardorvis' heal, every host's boss in a free-for-all, the bosses placed as monsters, the Hydra's forms, the walk round the room, Phosani's dream fought by monsters, the player's start in every arena");
process.exit(0);
