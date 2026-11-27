// The NPCs a sandbox scenario can place: monsters whose models and
// sequences the trimmed game cache already holds, because another encounter
// draws them. Hitpoints and combat stats come from the monster table
// (TABLE, client/data/monsters.js) by NPC type id; what an entry says here
// is how the sandbox's one NPC behaviour (brawler.js) fights with it.
//
// Every entry:
//   id            the name a scenario file uses ("inferno.meleer"); never
//                 change one, scenarios that were shared name it
//   name, group   what the editor lists
//   npcTypeId     CACHE, and the key into TABLE
//   size          CACHE, TABLE
//   attackSpeed   ticks between attacks
//   attacks       one or more { style, range, clip, maxHit?, windupTicks?,
//                 hits?, volley?, ...: `hits` hits at once (the jaguar's
//                 claws), `volley` [{ style, maxHit?, flight? ... }] one a tick
//                 (the manticore's orbs), each rolled with a hitsplat of its own;
//                 projectile?, flight?, parts?, targetGraphic? }: `style` is
//                 "melee", "range" or "magic"; of the attacks that reach, one
//                 is drawn at random. `projectile` is a timed projectile
//                 ({ spotAnimId, timing, slope, startHeight, endHeight }: the
//                 hit lands when it arrives), `flight` one of fixed cycles
//                 (the hit lands on the tick it ends), `parts` a projectile
//                 of several spot animations on one timing (Jad's magic),
//                 `targetGraphic` a spot animation on the target's tile;
//                 `windupTicks` delays all of it and the hit (Jad's three);
//                 `chargedVolley` a charge that shows the orbs it will throw,
//                 then one a tick (the manticore's: colosseum/sandbox.js);
//                 `special` an attack of the encounter's own that lands on
//                 tiles and can be walked out of ({ id, spotAnimIds, start,
//                 land }: Sol Heredit's spear and shield, in
//                 sol-heredit/sandbox.js; brawler.js starts it and
//                 encounter.js lands it)
//                 `everyNth` makes an attack come on that attack of the count
//                 and only then (the javelin colossus's high throw)
//   heal          { belowFraction, range, clip, graphic }: out of reach of
//                 its target it heals one of its side (the minotaur)
//   immobile      true: never moves (TzKal-Zuk, the Leviathan, Duke Sucellus, Zebak)
//   lockedFacing  the one way it faces, as in its own fight (Zebak)
//   statsVersion  the table's set of its stats it fights with (the Maggot King's "Far")
//   closesIn      { belowFraction, statsVersion }: below that share of its
//                 hitpoints it comes in and fights beside its target, with
//                 that set of stats (the Maggot King's near phase)
//   enrage        { belowFraction, attackSpeed, clip?, npcTypeId? }: below
//                 that share of its hitpoints it attacks faster, with a cue
//                 and a form of its own (Araxxor, Zebak, Duke Sucellus)
//   companion     { name, npcTypeId, idleSeqId, deathSeqId, clips }: a second
//                 body drawn with it, playing its clips (Zebak's tail; sandbox/bodies.js)
//   rotation      { every, styles, switchClips? }: `every` attacks of one
//                 style, then of the next, with a cue (the Corrupted Hunllef)
//   protects      { forms, switchAfter }: prays against one style, a form of
//                 its own showing which, until `switchAfter` hits of another
//                 style (the Corrupted Hunllef)
//   tornadoes     { firstTicks, everyTicks, delayTicks, counts, lifetime,
//                 damage, spread, npcTypeId, clip, impactSpotAnimId }: calls
//                 tornadoes that chase its target (the Corrupted Hunllef;
//                 sandbox/bodies.js)
//   forms         [{ belowFraction, npcTypeId, statsVersion?, attackSpeed?,
//                 rotationEvery?, clip?, attacks?: { <style>: { maxHit?, hits? } } }]:
//                 below each mark it takes that form, with its stats, speed and
//                 max hits, and plays its cue (the Alchemical Hydra's heads)
//   spawnsEvery   { firstTicks, everyTicks, max, distance, cycle, graphic? }:
//                 a monster of the cycle comes beside it by the clock (Araxxor's araxytes)
//   recoils       { melee }: that share of a melee hit on it goes back (the Mirrorback)
//   explodes      { fuseTicks, onPlayer, onNpc, clip, spotAnimId }: beside its
//                 target it blows up, hurting all around by how far (the Ruptura)
//   an attack's `screech` { graphic, window, prayerDamage, roaringStats, larva? } (the Maggot King)
//                 and `leech` { start } (his larvae), in brawler.js
//   alsoLoads, spotAnimIds   what else the scene loads for it (forms, tornadoes, graphics)
//   idleSeqId, walkSeqId?, deathSeqId, clips   the sequences the scene loads
//
// Each encounter keeps the entries of its own monsters, next to the ids,
// sequences and projectiles they copy (<encounter>/sandbox.js); this module
// only gathers them. The sources of each number are named there. Where an
// encounter's own monster does something the sandbox does not (Jad's prayer
// switch, the manticore's charge, the healers), the entry is the plain
// version, and its speed or reach is "inferred" from the original.
import { infernoSandboxEntries } from "../inferno/sandbox.js";
import { colosseumSandboxEntries } from "../colosseum/sandbox.js";
import { solHereditSandboxEntries } from "../sol-heredit/sandbox.js";
import { vardorvisSandboxEntries } from "../vardorvis/sandbox.js";
import { doomSandboxEntries } from "../doom-of-mokhaiotl/sandbox.js";
import { yamaSandboxEntries } from "../yama/sandbox.js";
import { araxxorSandboxEntries } from "../araxxor/sandbox.js";
import { leviathanSandboxEntries } from "../leviathan/sandbox.js";
import { dukeSucellusSandboxEntries } from "../duke-sucellus/sandbox.js";
import { zebakSandboxEntries } from "../tombs-of-amascut/sandbox.js";
import { maggotKingSandboxEntries } from "../maggot-king/sandbox.js";
import { corruptedHunllefSandboxEntries } from "../corrupted-hunllef/sandbox.js";
import { alchemicalHydraSandboxEntries } from "../alchemical-hydra/sandbox.js";
import { phosanisNightmareSandboxEntries } from "../phosanis-nightmare/sandbox.js";

export const curatedNpcCatalog = [
  ...infernoSandboxEntries,
  ...colosseumSandboxEntries,
  ...solHereditSandboxEntries,
  ...vardorvisSandboxEntries,
  ...doomSandboxEntries,
  ...yamaSandboxEntries,
  ...araxxorSandboxEntries,
  ...leviathanSandboxEntries,
  ...dukeSucellusSandboxEntries,
  ...zebakSandboxEntries,
  ...maggotKingSandboxEntries,
  ...corruptedHunllefSandboxEntries,
  ...alchemicalHydraSandboxEntries,
  ...phosanisNightmareSandboxEntries,
];

// What the encounters draw that is not a monster to place, each with its
// reason. test/test-sandbox-catalog.mjs fails for any other NPC an encounter
// draws (with stats in the monster table and an attack clip) that the
// catalog does not hold: a new encounter gives its monsters entries in its
// own sandbox.js, or reasons here.
export const sandboxCatalogExclusions = {
  9035: "the Corrupted Hunllef praying against melee: a form of the catalog's Hunllef (corrupted_hunllef), which turns into it as it switches its prayer",
  9037: "the Corrupted Hunllef praying against magic: as above",
  11732: "Zebak enraged: a form of the catalog's Zebak, which turns into it below a quarter of his hitpoints",
  8616: "the Alchemical Hydra losing its first head: only drawn for the 2 ticks of its change",
  8617: "the Alchemical Hydra losing its second head: as above, for 1 tick",
  8618: "the Alchemical Hydra losing its third head: as above, for 2 ticks",
  8619: "the Alchemical Hydra, electric: a form of the catalog's Hydra (alchemical_hydra), which takes it below three quarters of its hitpoints",
  8620: "the Alchemical Hydra, flame: a form of the catalog's Hydra, below half",
  8621: "the Alchemical Hydra, enraged: a form of the catalog's Hydra, below a quarter",
  8622: "what is left of the Alchemical Hydra: only drawn for the 7 ticks of its death",
  11153: "Phosani's Nightmare, her second form: a form of the catalog's Nightmare (phosanis_nightmare), below two thirds of her hitpoints",
  9418: "Phosani's Nightmare, her third form: a form of the catalog's Nightmare, below a third",
  9417: "Phosani's Nightmare, her fourth form: only in her dream, where her forms start from any of the four",
  9419: "Phosani's Nightmare with her shield down, while her totems are charged: her shield and totems are her dream's, where she is fought as the host (arenas.js)",
  9420: "Phosani's Nightmare with her shield down: as above",
  9421: "Phosani's Nightmare with her shield down: as above",
  11155: "Phosani's Nightmare with her shield down: as above",
  9422: "Phosani's Nightmare charging her blast while the sleepwalkers come: she never attacks in this form",
  11154: "Phosani's Nightmare's desperation: her claws without end, after her third blast: her dream's",
  9466: "a husk of Phosani's Nightmare: it rises beside a player she holds in her trance, and never moves",
  9467: "a husk of Phosani's Nightmare: as above",
  9468: "a parasite of Phosani's Nightmare: it bursts out of a player she infected, and heals her shield or drains her totems",
  9469: "a weakened parasite of Phosani's Nightmare: as above",
  9470: "a sleepwalker of Phosani's Nightmare: it has no attack, and walks to her to power her blast",
  12167: "Duke Sucellus asleep: only drawn until he wakes, and has no attack",
  12825: "the healing totem of a Colosseum modifier: it heals and never moves",
  14709: "the Doom of Mokhaiotl burrowed: the Doom himself under the floor, between his shield and his surfacing",
};

export const sandboxNpcCatalog = curatedNpcCatalog;

const catalogById = new Map(sandboxNpcCatalog.map((entry) => [entry.id, entry]));
export const getSandboxNpcEntry = (id) => catalogById.get(id);

// The special attacks of the catalog by id: a strike waiting to land names
// its special by id (encounter.js), so that the encounter's state stays data.
const specialById = new Map(sandboxNpcCatalog.flatMap((entry) => entry.attacks.filter((attack) => attack.special).map((attack) => [attack.special.id, attack.special])));
export const getSandboxSpecialAttack = (id) => specialById.get(id);

// What the scene loads for every entry (a render config's preloadNpcTypes).
// Its other forms, its companion and its tornadoes too (alsoLoads, companion).
export const sandboxPreloadNpcTypes = sandboxNpcCatalog.flatMap((entry) => [
  {
    npcTypeId: entry.npcTypeId,
    ...(entry.idleSeqId === undefined ? {} : { idleSeqId: entry.idleSeqId }),
    ...(entry.walkSeqId === undefined ? {} : { walkSeqId: entry.walkSeqId }),
    attackClips: entry.clips,
    deathSeqId: entry.deathSeqId,
  },
  ...(entry.companion ? [{ npcTypeId: entry.companion.npcTypeId, idleSeqId: entry.companion.idleSeqId, attackClips: entry.companion.clips, deathSeqId: entry.companion.deathSeqId }] : []),
  ...(entry.alsoLoads ?? []),
]);
// An attack's parts too: a volley's orbs fly as its own, and a charged
// volley holds, throws and lands its orbs (the manticore's).
const attackAndParts = (attack) => [
  attack,
  ...(attack.volley ?? []),
  ...Object.values(attack.chargedVolley?.orbs ?? {}).map((orb) => ({ flight: { spotAnimId: orb.spotAnimId }, targetGraphic: { spotAnimId: orb.impactSpotAnimId } })),
];
export const sandboxSpotAnimIds = [
  ...new Set(
    sandboxNpcCatalog.flatMap((entry) =>
      entry.attacks
        .flatMap(attackAndParts)
        .flatMap((attack) => [
          attack.projectile?.spotAnimId,
          attack.flight?.spotAnimId,
          attack.targetGraphic?.spotAnimId,
          ...(attack.parts?.spotAnims.map((part) => part.spotAnimId) ?? []),
          ...(attack.special?.spotAnimIds ?? []),
        ])
        .concat(entry.spotAnimIds ?? [])
        .filter((id) => id !== undefined),
    ),
  ),
];
