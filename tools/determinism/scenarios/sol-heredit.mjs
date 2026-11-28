// Sol Heredit, the final wave of the Fortis Colosseum (kind "sol_heredit").
//
// Sol walks up to the player and then stands still for as long as the player
// stays next to him, so most scripts order one attack and then answer what he
// does. His HP is moved with the two actions of the practice panel:
// `setBossHp` only changes the number (the phase then changes when the next
// real hit lands, as in a real fight), `applyBossHpPreset` also resets the
// encounter to the phase of that HP.
import {
  attack, boss, castOn, command, equip, item, magicGear, meleeGear, protect, rangedGear, setBossHp, special, unequip, use,
} from "./common.mjs";

const SOL = "sol_heredit";
const SOL_SIZE = 5;
const WARBANDER = "sol_quartet_warbander";
const sanfewSerum = 10925; // in the inventory at the start it counts as a pre-pot: immune to poison from the first tick
const noxiousHalberd = 29796;
const rune = { fire: 554, water: 555, air: 556, death: 560, blood: 565, wrath: 21880 };

/** Boss HP (of 1500) at which each phase starts. The panel has a button for each but the 25% one. */
const hpAt = { start: 1500, triple: 1350, grapple: 1125, longTriple: 750, quarter: 375, enrage: 150 };

/** A debug button of the panel: "trigger-grapple" | "trigger-triple" | "spawn-crystal" | "strike-sand" | "clear-sand". */
const debug = (api, type) => command(api, { encounter: SOL, type });
const applyPreset = (api, hp) => api.act({ type: "applyBossHpPreset", hp });

/** What the encounter shows of itself: phase, dangerTiles, grapple, tripleHitTicks, sandTiles, beamTiles, ... */
const seen = (api) => api.engine.getEncounterSnapshot().state;
/** False once Sol or the player is dead: nothing more to answer. */
const fightIsOn = (api) => api.player().alive && boss(api) !== undefined;

const attackBoss = (api) => attack(api, SOL);
/** A click on the ground: the application drops the attack target, then walks. */
function walkTo(api, x, y) {
  attack(api, null);
  api.moveTo(x, y);
}

// ---------------------------------------------------------------------------
// Tiles.

/** The floor of the arena: a 14 x 14 square without its four corner tiles. */
const arena = { minX: 26, maxX: 39, minY: 28, maxY: 41 };
function inArena([x, y]) {
  const onEdgeX = x === arena.minX || x === arena.maxX;
  const onEdgeY = y === arena.minY || y === arena.maxY;
  return x >= arena.minX && x <= arena.maxX && y >= arena.minY && y <= arena.maxY && !(onEdgeX && onEdgeY);
}
const onTile = (tiles, [x, y]) => tiles.some((tile) => tile[0] === x && tile[1] === y);
const steps = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
/** Whether an NPC (position = its south-west tile) stands on a tile. */
const covers = (npc, [x, y]) => x >= npc.position[0] && x < npc.position[0] + npc.size && y >= npc.position[1] && y < npc.position[1] + npc.size;
const underSol = (api, tile) => covers(boss(api), tile);

/**
 * Where a tile is seen from Sol: in front of one of his four sides ("south",
 * "north", "west", "east"), under him, or off a corner. His spear points the
 * same way at every tile in front of one side.
 */
function sideOfSol(api, [x, y]) {
  const [sx, sy] = boss(api).position;
  const alongX = x >= sx && x < sx + SOL_SIZE;
  const alongY = y >= sy && y < sy + SOL_SIZE;
  if (alongX) return alongY ? "under" : y < sy ? "south" : "north";
  return alongY ? (x < sx ? "west" : "east") : "corner";
}

/** The nearest tile (west and south first) on the floor, not under Sol, not in `tiles`, that `accept` allows. */
function nearestTileOutside(api, tiles, accept = () => true, reach = 4) {
  const [px, py] = api.player().position;
  for (let ring = 1; ring <= reach; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const tile = [px + dx, py + dy];
        if (steps(tile, [px, py]) === ring && inArena(tile) && !underSol(api, tile) && !onTile(tiles, tile) && accept(tile)) return tile;
      }
    }
  }
  return null;
}

/** The tile of `tiles` nearest to the player that is not under Sol (the first of the nearest). */
function nearestTileOf(api, tiles) {
  const here = api.player().position;
  let best = null;
  for (const tile of tiles) if (!underSol(api, tile) && (!best || steps(tile, here) < steps(best, here))) best = tile;
  return best;
}

// ---------------------------------------------------------------------------
// What a player does about each attack.

/**
 * Footwork: steps out of a telegraphed spear or shield attack. The telegraph
 * is drawn for where the player stands now, so the step stays in front of the
 * same side of Sol when it can. Returns whether an attack is on its way.
 */
function dodgeGroundAttack(api) {
  const { dangerTiles } = seen(api);
  const here = api.player().position;
  if (onTile(dangerTiles, here)) {
    const side = sideOfSol(api, here);
    const safe = nearestTileOutside(api, dangerTiles, (tile) => sideOfSol(api, tile) === side) ?? nearestTileOutside(api, dangerTiles);
    if (safe) walkTo(api, ...safe);
  }
  return dangerTiles.length > 0;
}

/**
 * The triple attack is answered with Protect from Melee switched on in the
 * tick of each hit and off again straight after: a prayer that is already up
 * the tick before a hit is punished.
 */
function flickTripleAttack(tick, api) {
  const praying = api.player().activePrayer === "ProtectMelee";
  if (seen(api).tripleHitTicks.includes(tick) !== praying) protect(api, "ProtectMelee");
}

/**
 * A click on a worn-equipment slot. The application asks the encounter first
 * (acceptsInput) and records the click only when it says yes, which Sol does
 * while a grapple is pending. Returns whether the click went through.
 */
function clickWornSlot(api, slot) {
  const accepted = api.acceptsInput({ kind: "equipmentSlotClick", slot });
  if (accepted) api.act({ type: "equipmentSlotClick", slot });
  return accepted;
}

/** Walks into a charging beam, to be hit when it fires. */
function standInBeam(api) {
  const { beamTiles } = seen(api);
  if (beamTiles.length > 0 && !onTile(beamTiles, api.player().position)) walkTo(api, ...nearestTileOf(api, beamTiles));
}
/** Walks out of the charging beams. */
function leaveBeam(api) {
  const { beamTiles } = seen(api);
  if (onTile(beamTiles, api.player().position)) walkTo(api, ...nearestTileOutside(api, beamTiles));
}

const swarms = (api) => api.npcs().filter((npc) => npc.id.startsWith("sol_bees"));
const totem = (api) => api.npcs().find((npc) => npc.id.startsWith("sol_totem"));

// ---------------------------------------------------------------------------

const sol = { kind: SOL, mechanics: { infiniteHealth: true } };
const level = (value) => ({ current: value, max: value });
const modifiers = (selection) => ({ options: { modifiers: selection } });

export const scenarios = [
  {
    // Members no fight calls: the arena made without the cache, the sand's pool lookup, an unknown debug action, and the setup note the menu shows.
    name: "sol-heredit/encounter-surface",
    pure(engine, objTypeLoader, registry) {
      const simulation = engine.createSimulationEngine({
        encounterConfig: { kind: SOL, mechanics: {} }, objTypeLoader, combatSeed: 1,
        inventory: engine.createEmptyInventory(), equipment: {}, combatSupplies: engine.createEmptyCombatSupplies(), attackStylePerCategory: {},
      });
      const { encounter } = simulation;
      const arena = encounter.getArenaConfig();
      let unknownAction;
      try {
        simulation.executeEncounterCommand({ encounter: SOL, type: "no-such-action" });
      } catch (error) {
        unknownAction = `${error.name}: ${error.message}`;
      }
      const halberd = 29796;
      const loadouts = [
        { equipment: { weapon: halberd }, inventory: [], modifiers: {} },
        { equipment: {}, inventory: [null, { id: halberd }], modifiers: {} },
        { equipment: { weapon: halberd }, modifiers: { myopia: 1 } },
        { equipment: {}, modifiers: {} },
      ];
      return {
        arena: { bounds: arena.bounds, walkableTiles: [...arena.walkableTiles], collisionMap: arena.collisionMap },
        sandPoolAtStart: encounter.sand.hasPoolAt([31, 36]),
        unknownAction,
        setupNotes: registry.getDescriptor(SOL).setupNotes.map((note) => [note.id, note.message, loadouts.map((loadout) => note.applies(loadout))]),
      };
    },
  },
  {
    // The engine takes the boss away in the middle of the fight (his definition's onDespawn); the run goes on without him.
    name: "sol-heredit/boss-despawned",
    kind: SOL,
    mechanics: { infiniteHealth: true },
    seed: 113,
    ticks: 24,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) attackBoss(api);
      if (tick === 10) api.engine.despawnNpc(boss(api).id);
    },
  },
  {
    // Every phase change by real damage (taunt, sand, new crystal) with nothing dodged or parried, a special attack, the kill and the ticks after it.
    name: "sol-heredit/melee-through-every-phase",
    ...sol,
    seed: 101,
    ticks: 240,
    ...meleeGear,
    inventory: [item.dragonClaws],
    script(tick, api) {
      if (!fightIsOn(api)) return;
      if (tick === 1) attackBoss(api);
      if (tick === 8) debug(api, "trigger-triple"); // forced while his own attacks are on
      // Just above each threshold, so that the next hit that lands crosses it.
      if (tick === 20) setBossHp(api, hpAt.triple + 2);
      if (tick === 30) equip(api, 0, "weapon"), attackBoss(api); // dragon claws; wielding a weapon drops the target
      if (tick === 31) special(api);
      if (tick === 36) equip(api, 0, "weapon"), equip(api, 1, "shield"), attackBoss(api); // fang and defender again
      if (tick === 40) debug(api, "trigger-grapple");
      if (tick === 60) setBossHp(api, hpAt.grapple + 2);
      if (tick === 100) setBossHp(api, hpAt.longTriple + 2);
      if (tick === 140) setBossHp(api, hpAt.quarter + 2);
      if (tick === 170) setBossHp(api, hpAt.enrage + 2); // then enraged until he dies of the player's hits
    },
  },
  {
    // The triple attack forced with his own attacks off: short and long, flicked perfectly, prayed too early, not prayed.
    name: "sol-heredit/triple-attack-prayers",
    kind: SOL,
    mechanics: { infiniteHealth: true, infiniteSpecialAttack: true, solHereditAttacks: false },
    seed: 102,
    ticks: 215,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) attackBoss(api);
      if (tick % 12 === 0) special(api);
      const rounds = [6, 30, 60, 90, 120, 150, 180]; // one triple attack each
      if (rounds.includes(tick)) debug(api, "trigger-triple");
      if (tick === 5) applyPreset(api, hpAt.triple);
      if (tick < 30) return flickTripleAttack(tick, api); // short, every hit blocked
      if (tick < 60) return; // short, no prayer
      if (tick === 60) applyPreset(api, hpAt.grapple);
      if (tick < 90) return flickTripleAttack(tick, api); // the faster short one
      if (tick === 90) applyPreset(api, hpAt.longTriple);
      if (tick < 120) return flickTripleAttack(tick, api); // long, every hit blocked
      if (tick < 150) {
        if (tick === 122) protect(api, "ProtectMelee"); // up before the first hit: he turns it off and locks prayers
      } else if (tick < 180) {
        const { tripleHitTicks } = seen(api);
        if (tripleHitTicks.length === 1 && tick === tripleHitTicks[0] - 1) protect(api, "ProtectMelee"); // up before the last hit
      } // the last round: long, no prayer
    },
  },
  {
    // The grapple forced with his own attacks off: perfect parry (and the guaranteed max hit after it), early parry after wrong slots, failure, a bare slot.
    name: "sol-heredit/grapple-answers",
    kind: SOL,
    mechanics: { infiniteHealth: true, solHereditAttacks: false },
    seed: 103,
    ticks: 125,
    ...rangedGear,
    start: [33, 35],
    script(tick, api) {
      const { grapple } = seen(api);
      if (tick === 1) attackBoss(api);
      if (tick === 2) clickWornSlot(api, "body"); // refused: no grapple yet
      if (tick === 3) api.act({ type: "equipmentSlotClick", slot: "body" }); // sent all the same, as a replay could: ignored
      if (tick === 5) applyPreset(api, hpAt.grapple);
      if (tick === 6 || tick === 40 || tick === 70 || tick === 100) debug(api, "trigger-grapple");
      if (tick === 118) applyPreset(api, hpAt.start); // back to the first phase: the crystals go
      if (!grapple) return;
      if (tick < 40) {
        if (tick === grapple.resolveTick) clickWornSlot(api, grapple.slot); // in its last tick: a perfect parry
      } else if (tick < 70) {
        if (tick === grapple.resolveTick - 3) for (const wrong of ["weapon", "ammo", "quiver-ammo"]) clickWornSlot(api, wrong);
        if (tick === grapple.resolveTick - 2) clickWornSlot(api, grapple.slot); // early: an ordinary parry
      } else if (tick < 100) {
        if (tick === grapple.resolveTick - 1) clickWornSlot(api, grapple.slot === "body" ? "legs" : "body"); // only the wrong part
      } else {
        if (tick === grapple.resolveTick - 2) unequip(api, grapple.slot);
        if (tick === grapple.resolveTick - 1) clickWornSlot(api, grapple.slot); // nothing worn there: does not count
      }
    },
  },
  {
    // Spear, shield and random attacks side-stepped from each side of Sol, then taken standing under his middle and each of his corners (he shuffles off; the spear goes diagonal).
    name: "sol-heredit/ranged-footwork",
    kind: SOL,
    mechanics: { infiniteHealth: true, solHereditAttackStyle: "spear", solHereditTelegraph: true },
    seed: 104,
    ticks: 299,
    ...rangedGear,
    script(tick, api) {
      if (tick === 90) api.mechanics({ solHereditAttackStyle: "shield" });
      if (tick === 150) api.mechanics({ solHereditAttackStyle: "random" });
      if (tick === 240) api.mechanics({ solHereditAttackStyle: "spear" });
      if (tick === 297) api.mechanics({ solHereditAttacks: false }); // switched off in mid-swing
      const here = api.player().position;
      if (tick >= 240) {
        // No more dodging: under his middle, then his south-west, south-east, north-east and north-west corner, 12 ticks each.
        const [sx, sy] = boss(api).position;
        const far = SOL_SIZE - 1;
        const [dx, dy] = [[2, 2], [0, 0], [far, 0], [far, far], [0, far]][Math.floor((tick - 240) / 12)];
        if (here[0] !== sx + dx || here[1] !== sy + dy) walkTo(api, sx + dx, sy + dy);
        return;
      }
      if (dodgeGroundAttack(api)) return;
      // A post on the south, east, north and west of the arena, 60 ticks each.
      const post = [[33, 31], [37, 34], [33, 38], [28, 34]][Math.floor(tick / 60)];
      if (steps(here, post) > 2) walkTo(api, ...post);
      else if (api.player().attackTarget === null) attackBoss(api);
    },
  },
  {
    // Beam crystals: all four by hand (a fifth is refused), a beam taken and a beam side-stepped, the beams switched off while idle, primed and charging, enraged beams.
    name: "sol-heredit/beam-crystals",
    kind: SOL,
    mechanics: { infiniteHealth: true, solHereditAttacks: false },
    ...modifiers({ relentless: 2 }),
    seed: 105,
    ticks: 130,
    ...magicGear,
    script(tick, api) {
      if (tick === 1) {
        attackBoss(api);
        for (let press = 0; press < 5; press++) debug(api, "spawn-crystal");
      }
      // Switched off for a moment while idle (12), primed (36: a volley was announced at 35) and charging (43).
      if (tick === 12 || tick === 36 || tick === 43) api.mechanics({ solHereditBeams: false });
      if (tick === 14 || tick === 38 || tick === 44) api.mechanics({ solHereditBeams: true });
      if (tick === 60 || tick === 90) applyPreset(api, hpAt.enrage); // four fresh crystals, a volley every 11 ticks
      if (tick === 100) setBossHp(api, hpAt.enrage + 10); // out of the enrage...
      if (tick === 104) setBossHp(api, hpAt.enrage - 10); // ...and into it again, without a reset
      const takesIt = tick < 12 || (tick >= 60 && tick < 70);
      if (takesIt) standInBeam(api);
      else leaveBeam(api);
    },
  },
  {
    // Molten sand: struck while switched off (not shown, no burn, also across a phase change), switched on (it burns), stepped out of, cleared, struck again; the boss killed from the panel while pools are forming.
    name: "sol-heredit/molten-sand",
    kind: SOL,
    mechanics: { infiniteHealth: true, solHereditAttacks: false, solHereditBeams: false, solHereditSand: false },
    seed: 106,
    ticks: 70,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) attackBoss(api);
      if (tick === 5) debug(api, "strike-sand");
      if (tick === 12) setBossHp(api, hpAt.triple + 2); // the next hit starts the second phase: sand again, no crystal (beams are off)
      if (tick === 25) api.mechanics({ solHereditSand: true });
      if (tick === 31) walkTo(api, ...nearestTileOutside(api, seen(api).sandTiles));
      if (tick === 36) debug(api, "clear-sand");
      if (tick === 37) attackBoss(api);
      if (tick === 40) debug(api, "strike-sand");
      if (tick === 55 || tick === 58) debug(api, "strike-sand"); // pools form five ticks after a strike
      if (tick === 61) setBossHp(api, 0);
      if (tick === 63) debug(api, "strike-sand"); // he is dead: ignored
    },
  },
  {
    // Bees! 3, Quartet (a berserker), Totemic, Relentless 3: stings (immune to their poison), a swarm killed and back 60 ticks later, the warbander's sure hits, the totem healing,
    // taken away by a preset, killed and back 200 ticks later, the warbander frozen and wrong-footed, all of them swept away when Sol dies.
    name: "sol-heredit/modifiers-swarms-warband-totem",
    ...sol,
    ...modifiers({ bees: 3, quartet: 1, totemic: 1, relentless: 3 }),
    seed: 107,
    ticks: 345,
    ...rangedGear,
    supplies: { ...rangedGear.supplies, spellbook: "ancient", runePouch: { kind: "divine", slots: [{ id: rune.water }, { id: rune.blood }, { id: rune.death }] } },
    inventory: [sanfewSerum],
    script(tick, api) {
      if (!fightIsOn(api)) return;
      if (tick === 1) attackBoss(api);
      // 30-40: a swarm that is on the player is shot (they have 1 HP); it stings once more as it falls.
      const stinging = swarms(api).find((swarm) => covers(swarm, api.player().position));
      if (tick >= 30 && tick < 40 && stinging) attack(api, stinging.id);
      if (tick === 40) attackBoss(api);
      if (tick === 60) setBossHp(api, hpAt.longTriple + 2); // the next hit takes him to half: the totem appears
      if (tick === 100) applyPreset(api, hpAt.longTriple); // takes the totem away; a new one is there at once
      if (tick === 110) attack(api, totem(api).id);
      if (tick === 116) attackBoss(api); // the next totem is due 200 ticks after this one fell
      // The warbander is frozen where it stands, south of the player. The player walks four tiles on (under Sol)
      // and, the moment it thaws, two tiles back: the warbander finds itself in place with steps left over.
      // In ranged gear the barrage can miss (it is not the berserker's sure hit), so it is cast again until it freezes.
      const warbander = api.npcs().find((npc) => npc.id === WARBANDER);
      const thawsAt = warbander?.debuffs?.boundUntilTick;
      if (tick >= 130 && tick % 6 === 4 && warbander && thawsAt === undefined) castOn(api, WARBANDER, "Ice Barrage");
      if (thawsAt !== undefined && tick === thawsAt - 24) attackBoss(api);
      if (thawsAt !== undefined) {
        const [wx, wy] = warbander.position;
        if (tick === thawsAt - 4) walkTo(api, wx, wy + 5);
        if (tick === thawsAt) walkTo(api, wx, wy + 3);
        if (tick === thawsAt + 4) attackBoss(api);
      }
      if (tick === 200) walkTo(api, 34, 28); // on the south edge the warbander's place, the tile south of the player, is off the floor
      if (tick === 215) attackBoss(api);
      if (tick === 335) setBossHp(api, 0); // with the second totem, the swarms and the warbander still there
    },
  },
  {
    // Solarflare 3, Volatility 3, Frailty 3, Blasphemy 3, Myopia 3, Doom 2: on an orb's corner with a prayer up, a brew that cannot overheal, prayer drained by his hits, doom past its limit (infinite health), his death blast.
    name: "sol-heredit/modifiers-solarflare-and-curses",
    ...sol,
    ...modifiers({ solarflare: 3, volatility: 3, frailty: 3, blasphemy: 3, myopia: 3, doom: 2 }),
    seed: 108,
    ticks: 110,
    ...rangedGear,
    inventory: [item.saradominBrew],
    start: [34, 31], // the bow now reaches 4 tiles: he walks up to (34,33), where an orb starts its lap
    script(tick, api) {
      if (!fightIsOn(api)) return;
      if (tick === 1) attackBoss(api);
      if (tick === 2) use(api, 0);
      if (tick === 3 || tick === 22) protect(api, "ProtectMelee"); // the orb leaving the tile turns it off
      if (tick === 100) setBossHp(api, 0); // the blast, 9 ticks later, reaches two tiles past him
    },
  },
  {
    // Every modifier at tier 1, with the weapons Myopia tells apart: powered staff, a spell cast by hand, a fang, a halberd; a poisonous sting, the warbander killed, a slow orb, a death blast that falls short.
    name: "sol-heredit/modifiers-all-at-tier-one",
    ...sol,
    ...modifiers({ bees: 1, blasphemy: 1, doom: 1, frailty: 1, myopia: 1, quartet: 1, relentless: 1, solarflare: 1, totemic: 1, volatility: 1 }),
    seed: 111, // an archer joins
    ticks: 200,
    ...magicGear,
    supplies: { spellbook: "standard", runePouch: { kind: "divine", slots: [{ id: rune.fire }, { id: rune.air }, { id: rune.wrath }] } },
    inventory: [item.osmumtensFang, noxiousHalberd],
    start: [34, 33], // where an orb starts its lap
    script(tick, api) {
      if (!fightIsOn(api)) return;
      if (tick === 1) attackBoss(api);
      if (tick === 3) protect(api, "ProtectMagic"); // stays up at this tier
      if (tick === 20) castOn(api, SOL, "Fire Surge");
      if (tick === 24) attackBoss(api); // a spell cast by hand is one attack; back to the staff
      if (tick === 40) equip(api, 0, "weapon"), attackBoss(api); // fang
      if (tick === 70) equip(api, 1, "weapon"), attackBoss(api); // halberd
      if (tick === 90) attack(api, WARBANDER);
      if (tick === 120) attackBoss(api);
      if (tick === 130) setBossHp(api, hpAt.longTriple + 2);
      if (tick === 170) walkTo(api, 38, 29); // he follows
      if (tick === 178) walkTo(api, 27, 40); // and is left behind: the blast reaches one tile past him
      if (tick === 180) setBossHp(api, 0);
    },
  },
  {
    // Doom 3 with infinite health off: five burns of molten sand are five points of doom, and the fight is lost.
    name: "sol-heredit/doom-kills",
    kind: SOL,
    ...modifiers({ doom: 3, quartet: 1 }),
    seed: 113, // a seer joins (Quartet without Relentless)
    ticks: 12,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) attackBoss(api);
      if (tick === 3) debug(api, "strike-sand"); // under the player, who has walked up to Sol
    },
  },
  {
    // A fight lost to his spear, then the restart button twice: with the same encounter seed (this time dodging), and with a fresh one.
    name: "sol-heredit/death-and-restart",
    kind: SOL,
    seed: 111,
    ticks: 145,
    intro: true,
    startHp: 40,
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) api.skipIntro(); // Sol has no intro: nothing to skip
      if (tick === 1 || tick === 41 || tick === 121) attackBoss(api);
      if (tick === 40) api.restart(api.engine.encounter.getSeeds());
      if (tick === 120) api.restart();
      // The second life is spent on footwork: 40 HP are enough if nothing lands.
      if (tick > 41 && tick < 120 && !dodgeGroundAttack(api) && api.player().attackTarget === null) attackBoss(api);
    },
  },
  {
    // Volatility 2 with infinite health off: Sol is killed from the panel, and his death blast kills a weak player on the tick the victory was due.
    name: "sol-heredit/death-blast-kills",
    kind: SOL,
    ...modifiers({ volatility: 2 }),
    seed: 112,
    ticks: 20,
    ...meleeGear,
    stats: { ...Object.fromEntries(["attack", "strength", "defence", "ranged", "magic", "prayer", "agility"].map((skill) => [skill, level(99)])), hitpoints: level(15) },
    script(tick, api) {
      if (tick === 1) attackBoss(api);
      if (tick === 5) setBossHp(api, 0); // before his first attack lands
    },
  },
];
