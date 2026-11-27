// Araxxor and his araxytes in the sandbox (client/encounters/sandbox/): their
// catalog entries, in the format sandbox/catalog.js describes, from
// encounter.js. Araxxor walks, bites, shoots and casts, enrages below a
// quarter of his hitpoints, and every 42 ticks an araxyte comes beside him
// (in his lair, from his eggs). The Mirrorback throws back half of a melee
// hit; the Ruptura walks up and blows up. What is his lair's is left out:
// the eggs, the acid of his specials and the cleave's pools. His own fight
// never reads this file.
import { ids, maxHits, seqs, spots } from "./encounter.js";

const araxyte = { size: 2, attackSpeed: 6, idleSeqId: seqs.araxyteIdle, walkSeqId: seqs.araxyteWalk }; // CACHE, TABLE

export const araxxorSandboxEntries = [
  {
    id: "araxxor", name: "Araxxor", group: "Bosses", npcTypeId: ids.boss, size: 7, attackSpeed: 6, // CACHE; WIKI, OBS
    attacks: [
      { style: "melee", range: 1, clip: "attack", maxHit: maxHits.melee },
      // encounter.js: 10 tiles; both land 3 ticks after the cast (OBS). Its
      // choice of the lower of the player's defences is drawn at random here.
      { style: "range", range: 10, clip: "ranged", maxHit: maxHits.range, flight: { spotAnimId: spots.ranged, startDelayCycles: 30, endDelayCycles: 90, slope: 35, startOffset: 0, startHeight: 296, endHeight: 50 } },
      { style: "magic", range: 10, clip: "magic", maxHit: maxHits.magic, flight: { spotAnimId: spots.magic, startDelayCycles: 30, endDelayCycles: 90, slope: 35, startOffset: 62, startHeight: 69, endHeight: 50 } },
    ],
    // encounter.js: below a quarter, an attack every 4 ticks (WIKI, OBS).
    enrage: { belowFraction: 0.25, attackSpeed: 4, clip: "enrage" },
    // encounter.js: the first hatches 21 ticks in, one every 42 after, nine
    // in all, in the order of a pattern (green's here); beside him, with its hatch.
    spawnsEvery: {
      firstTicks: 21, everyTicks: 42, max: 9, distance: { min: 1, max: 3 },
      cycle: ["araxxor.acidic", "araxxor.mirrorback", "araxxor.ruptura"],
      graphic: { "araxxor.acidic": spots.hatch.acidic, "araxxor.mirrorback": spots.hatch.mirrorback, "araxxor.ruptura": spots.hatch.ruptura },
    },
    spotAnimIds: Object.values(spots.hatch),
    idleSeqId: seqs.idle, walkSeqId: seqs.walk, deathSeqId: seqs.death,
    clips: { attack: seqs.melee, ranged: seqs.ranged, magic: seqs.magic, enrage: seqs.enrage },
  },
  {
    id: "araxxor.acidic", name: "Acidic Araxyte", group: "Araxxor", npcTypeId: ids.araxytes.acidic, ...araxyte,
    attacks: [{ style: "range", range: 8, clip: "attack", maxHit: maxHits.acidic }], // OBS: it holds 8 tiles away; TABLE
    deathSeqId: seqs.explode, clips: { attack: seqs.acidicAttack },
  },
  {
    // encounter.js: its bite (a stab, inferred; TABLE max); half of a melee hit on it goes back (OBS).
    id: "araxxor.mirrorback", name: "Mirrorback Araxyte", group: "Araxxor", npcTypeId: ids.araxytes.mirrorback, ...araxyte,
    attacks: [{ style: "melee", range: 1, clip: "attack" }],
    recoils: { melee: 0.5 },
    deathSeqId: seqs.mirrorbackDeath, clips: { attack: seqs.mirrorbackAttack },
  },
  {
    // encounter.js: beside its target it blows up 2 ticks later, wherever that
    // is: 70, 49, 28 or 7 to a player 0 to 3 tiles away, 80, 64, 48 or 33 to an NPC (OBS).
    id: "araxxor.ruptura", name: "Ruptura Araxyte", group: "Araxxor", npcTypeId: ids.araxytes.ruptura, ...araxyte,
    attacks: [{ style: "melee", range: 1, clip: "explode" }],
    explodes: { fuseTicks: 2, onPlayer: [70, 49, 28, 7], onNpc: [80, 64, 48, 33], clip: "explode", spotAnimId: spots.rupturaExplosion },
    spotAnimIds: [spots.rupturaExplosion],
    deathSeqId: seqs.explode, clips: { explode: seqs.explode },
  },
];
