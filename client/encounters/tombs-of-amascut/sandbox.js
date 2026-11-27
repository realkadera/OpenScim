// Zebak in the sandbox (client/encounters/sandbox/): his catalog entry, in
// the format sandbox/catalog.js describes, from client/toa/zebak/. He never
// moves (immobile, wherever he is placed); his body is two NPCs, the head
// and the tail (native.js), so the tail comes along as his companion. His
// bite beside him and his magic and ranged spits are his own (an invocation
// level of 0, path 0: rules.js), and so is his enrage below a quarter of his
// hitpoints (phases.js). What is his room's is left out: the roar, the
// waves, the jugs, the boulders and the acid. His own fight never reads
// this file.

// rules.js, zebakAutoMaxHit(melee, 0, 0): a bite of 38, a spit of 16.
const biteMaxHit = 38;
const spitMaxHit = 16;
// native.js, timing.js: the pot (2176 magic, 2178 ranged) leaves his mouth,
// 309 high, 42 cycles into the spit and lands at 180 (standardSpit). In his
// room it bursts over the middle and its pieces fly on; here it flies
// straight to the target (inferred), landing 6 ticks after the spit.
const spit = (spotAnimId) => ({ spotAnimId, startDelayCycles: 42, endDelayCycles: 180, slope: 16, startOffset: 0, startHeight: 309, endHeight: 64 });

export const zebakSandboxEntries = [
  {
    // rules.js: an attack every 7 ticks on path 0, every 4 enraged.
    id: "zebak", name: "Zebak", group: "Bosses", npcTypeId: 11730, size: 9, attackSpeed: 7, immobile: true, // CACHE
    // native.js: he and his tail always face east, as in his room.
    lockedFacing: 1536,
    attacks: [
      // native.js: the bite lands a tick later.
      { style: "melee", range: 1, clip: "melee", maxHit: biteMaxHit, impactDelayTicks: 1 },
      { style: "magic", range: 30, clip: "attack", maxHit: spitMaxHit, flight: spit(2176) },
      { style: "range", range: 30, clip: "attack", maxHit: spitMaxHit, flight: spit(2178) },
    ],
    // phases.js: below a quarter of his hitpoints; native.js: NPC 11732 from then on.
    enrage: { belowFraction: 0.25, attackSpeed: 4, clip: "enrage", npcTypeId: 11732 },
    // native.js: the tail, NPC 11731, on the same tiles, with clips of the same names.
    companion: { name: "tail", npcTypeId: 11731, idleSeqId: 9619, deathSeqId: 9635, clips: { melee: 9621, attack: 9625, enrage: 9627 } },
    alsoLoads: [{ npcTypeId: 11732, idleSeqId: 9618, attackClips: { melee: 9622, attack: 9626, enrage: 9626 }, deathSeqId: 9634 }],
    idleSeqId: 9618, deathSeqId: 9634, clips: { melee: 9620, attack: 9624, enrage: 9626 },
  },
];
