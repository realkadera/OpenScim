// The Corrupted Hunllef in the sandbox (client/encounters/sandbox/): its
// catalog entry, in the format sandbox/catalog.js describes, from
// encounter.js. It walks, keeps to ranged or magic for four attacks and
// then switches, prays against one style (its form shows which) until six
// hits of another make it pray against that one, and calls tornadoes that
// chase its target. What is its room's is left out: the floor's tiles, and
// the armour tiers its hits are reduced by. Its own fight never reads this
// file.
import { protectionForms } from "./encounter.js";

const seqs = { idle: 8417, walk: 8416, attack: 8419, tornado: 8418, death: 8421, switchMagic: 8754, switchRange: 8755 }; // CACHE (presentation.js)
// encounter.js (inferred there): the projectile from 120 high to 100, landing 2 ticks later.
const shot = (spotAnimId) => ({ spotAnimId, startDelayCycles: 0, endDelayCycles: 60, slope: 0, startOffset: 0, startHeight: 120, endHeight: 100 });
const form = (npcTypeId) => ({ npcTypeId, idleSeqId: seqs.idle, walkSeqId: seqs.walk, deathSeqId: seqs.death,
  attackClips: { attack: seqs.attack, tornado: seqs.tornado, switchMagic: seqs.switchMagic, switchRange: seqs.switchRange } });

export const corruptedHunllefSandboxEntries = [
  {
    // encounter.js: an attack every 5 ticks (WIKI), from 6 tiles.
    id: "corrupted_hunllef", name: "Corrupted Hunllef", group: "Bosses", npcTypeId: protectionForms.range, size: 5, attackSpeed: 5, // CACHE
    attacks: [
      // WIKI: 68 without armour (encounter.js, unprayedMaxHits).
      { style: "range", range: 6, clip: "attack", maxHit: 68, flight: shot(1712) }, // CACHE
      { style: "magic", range: 6, clip: "attack", maxHit: 68, flight: shot(1708) },
    ],
    // encounter.js: four of a style, starting with ranged (WIKI), then a switch with its own clip the tick after.
    rotation: { every: 4, styles: ["range", "magic"], switchClips: { magic: "switchMagic", range: "switchRange" } },
    // encounter.js: a hit of the style it prays against does nothing; the
    // sixth of another style makes it pray against that (tsps).
    protects: { forms: protectionForms, switchAfter: 6 },
    // encounter.js: every 56 ticks (inferred there), 2, 3 or 4 by the third of
    // its hitpoints (WIKI), 2 ticks after the call, for 20 ticks (WIKI), 15 to
    // 30 a tick to whoever they stand on (WIKI, without armour).
    tornadoes: {
      firstTicks: 56, everyTicks: 56, delayTicks: 2, counts: [2, 3, 4], lifetime: 20, damage: [15, 30], spread: 4,
      npcTypeId: 9039, clip: "tornado", impactSpotAnimId: 1718, // CACHE
    },
    alsoLoads: [form(protectionForms.melee), form(protectionForms.magic), { npcTypeId: 9039, attackClips: {} }],
    spotAnimIds: [1718],
    idleSeqId: seqs.idle, walkSeqId: seqs.walk, deathSeqId: seqs.death,
    clips: { attack: seqs.attack, tornado: seqs.tornado, switchMagic: seqs.switchMagic, switchRange: seqs.switchRange },
  },
];
