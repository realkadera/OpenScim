// Phosani's Nightmare in the sandbox (client/encounters/sandbox/): her
// catalog entry, in the format sandbox/catalog.js describes, from
// encounter.js and ids.js. She walks up to her target and attacks every 6
// ticks: magic and ranged from afar, her melee beside it. Her forms come
// one after another as her hitpoints fall a third at a time, as her phases
// do (`forms`). What is her dream's is left out: her shield and the totems,
// the blasts, the sleepwalkers, her specials (claws, husks, parasites,
// curse, spores, flowers, surge) and her desperation. Her own fight never
// reads this file.
import { seqIds, spotAnims, formCycle } from "./ids.js";

// encounter.js: the projectile leaves 3 ticks after her animation (90 cycles)
// and lands 30 (magic) or 20 (ranged) cycles later, a cycle more a tile
// (tsps); here as from 6 tiles (inferred), 86 high to 31, slope 14, 96 out.
const flight = (spotAnimId, base) => ({ spotAnimId, startDelayCycles: 90, endDelayCycles: 90 + base + 6, slope: 14, startOffset: 96, startHeight: 86, endHeight: 31 });
const clips = { magic: seqIds.magic, range: seqIds.range, melee: seqIds.melee };
// ids.js: every form stands with 8593 and walks with 8592 (OBS (Outside)).
const formLoad = (npcTypeId) => ({ npcTypeId, idleSeqId: seqIds.idle, walkSeqId: seqIds.walk, attackClips: clips, deathSeqId: seqIds.death });

export const phosanisNightmareSandboxEntries = [
  {
    // encounter.js: an attack every 6 ticks (WIKI, TABLE, tsps); max hits 80
    // from afar, 73 beside her (WIKI); her magic and ranged land 4 ticks
    // after her animation, her melee 2 (tsps). Range 15 is inferred (her dream is 20 wide).
    id: "phosanis_nightmare", name: "Phosani's Nightmare", group: "Bosses", npcTypeId: formCycle[0], size: 5, attackSpeed: 6, // CACHE
    attacks: [
      { style: "magic", range: 15, clip: "magic", maxHit: 80, flight: flight(spotAnims.magic, 30), targetGraphic: { spotAnimId: spotAnims.magicImpact, height: 124 } },
      { style: "range", range: 15, clip: "range", maxHit: 80, flight: flight(spotAnims.range, 20) },
      { style: "melee", range: 1, clip: "melee", maxHit: 73, impactDelayTicks: 2 },
    ],
    // encounter.js: three phases a third of her 3,200 each (WIKI), her forms
    // one after another round their cycle (ids.js, formCycle; tsps).
    forms: [
      { belowFraction: 2 / 3, npcTypeId: formCycle[1] },
      { belowFraction: 1 / 3, npcTypeId: formCycle[2] },
    ],
    alsoLoads: [formLoad(formCycle[1]), formLoad(formCycle[2])],
    idleSeqId: seqIds.idle, walkSeqId: seqIds.walk, deathSeqId: seqIds.death, clips,
  },
];
