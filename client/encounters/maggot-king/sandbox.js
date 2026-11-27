// The Maggot King and his larvae in the sandbox (client/encounters/sandbox/):
// their catalog entries, in the format sandbox/catalog.js describes, from
// encounter.js and larvae.js. He spits ranged and magic from afar until
// two thirds of his hitpoints, then comes in and slams beside his target;
// after a few attacks he screeches: a player praying against a style is
// hurt every tick of it, and below 85% of his hitpoints a larva comes. A larva leeches its
// target, more each attack, and the King heals as much. What is his lair's
// is left out: the row of bones, the bile and the carrion. His own fight
// never reads this file.
import { npcTypeIds, seqIds, spotAnims } from "./ids.js";

// encounter.js: the spit flies from 45 to 60 cycles, from 260 to 100 high,
// slope 5, 370 out of his middle (OBS); it hits 2 ticks after.
const spit = (spotAnimId) => ({ spotAnimId, startDelayCycles: 45, endDelayCycles: 60, slope: 5, startOffset: 370, startHeight: 260, endHeight: 100 });

export const maggotKingSandboxEntries = [
  {
    // encounter.js: an attack every 5 ticks after his first screech (OBS, WIKI).
    id: "maggot_king", name: "Maggot King", group: "Bosses", npcTypeId: npcTypeIds.king, size: 5, attackSpeed: 5, // CACHE
    // TABLE: his sets of stats (encounter.js, versions): "Far" while he keeps
    // away, "Nearby" once he comes in, below 1000 of his 1500 (OBS), "Roaring" as he screeches.
    statsVersion: "Far",
    closesIn: { belowFraction: 1000 / 1500, statsVersion: "Nearby" },
    attacks: [
      { style: "range", range: 15, clip: "range", maxHit: 46, flight: spit(spotAnims.rangedSpit) }, // WIKI; range inferred
      { style: "magic", range: 15, clip: "magic", maxHit: 46, flight: spit(spotAnims.magicSpit) },
      // encounter.js: the head slam (WIKI 55), every 4 ticks (OBS), 2 ticks after the swing.
      { style: "melee", range: 1, clip: "slam", maxHit: 55, attackSpeed: 4, impactDelayTicks: 2, targetGraphic: { spotAnimId: spotAnims.slamImpact, height: 0 } },
      // encounter.js: a rotation is 4 to 7 attacks, ended by a screech (OBS);
      // here every sixth attack (inferred). 11 to 13 ticks to his next attack
      // (OBS); 15 to 25 a tick, from 3 to 8 ticks into it, to a player praying
      // against a style (WIKI, OBS); a larva below 1275 of his 1500 (OBS: 85%).
      {
        style: "magic", range: 15, clip: "screech", everyNth: 6, attackSpeed: 12,
        screech: { graphic: spotAnims.screech, window: [3, 8], prayerDamage: [15, 25], roaringStats: "Roaring", larva: { npc: "maggot_king.larva", belowFraction: 0.85 } },
      },
    ],
    spotAnimIds: [spotAnims.screech],
    idleSeqId: seqIds.idle, walkSeqId: seqIds.walk, deathSeqId: seqIds.death,
    clips: { range: seqIds.ranged, magic: seqIds.magic, slam: seqIds.slam, screech: seqIds.screech },
  },
  {
    // larvae.js: it leeches 1, then 2, 3 ... while it stays on its target
    // (OBS; WIKI starts at 3), and the King heals as much. Every tick (OBS).
    // A monster does not step off as a player does: at most 10 (inferred).
    id: "maggot_king.larva", name: "Ur-maggot larva", group: "Maggot King", npcTypeId: npcTypeIds.larva, size: 1, attackSpeed: 1, // CACHE
    attacks: [{ style: "melee", range: 1, clip: "leech", leech: { start: 1, max: 10 } }],
    idleSeqId: seqIds.larvaIdle, walkSeqId: seqIds.larvaWalk, deathSeqId: seqIds.larvaDeath, clips: { leech: seqIds.larvaIdle },
  },
];
