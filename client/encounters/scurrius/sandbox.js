// Scurrius and his giant rats in the sandbox (client/encounters/sandbox/):
// their catalog entries, in the format sandbox/catalog.js describes. His own
// fight's food piles, rubble and rat calls are his lair's; here he is the
// plain version: his three attacks, any of them at any distance he can reach
// with it. His own fight never reads this file.
import { npcTypeIds, seqIds, spotAnims } from "./ids.js";

// OBS (tsps): his bolts and fur balls fly 30 to 120 cycles and land as they end, 4 ticks after the cast.
const flight = (spotAnimId) => ({ spotAnimId, startDelayCycles: 30, endDelayCycles: 120, slope: 40, startOffset: 0, startHeight: 50, endHeight: 25 });

export const scurriusSandboxEntries = [
  {
    id: "scurrius", name: "Scurrius", group: "Bosses", npcTypeId: npcTypeIds.solo, size: 3, attackSpeed: 4, // TABLE
    attacks: [
      { style: "melee", range: 1, clip: "melee", maxHit: 13 }, // WIKI: the tail swipe
      // WIKI: solo max hits. inferred: their reach, the room's width (tsps: 20).
      { style: "magic", range: 10, clip: "magic", maxHit: 8, flight: flight(spotAnims.magicProjectile), targetGraphic: { spotAnimId: spotAnims.magicImpact, height: 0 } },
      { style: "range", range: 10, clip: "ranged", maxHit: 7, flight: flight(spotAnims.rangedProjectile), targetGraphic: { spotAnimId: spotAnims.rangedImpact, height: 0 } },
    ],
    idleSeqId: seqIds.idle, walkSeqId: seqIds.walk, deathSeqId: seqIds.death,
    clips: { melee: seqIds.melee, magic: seqIds.magic, ranged: seqIds.ranged },
  },
  {
    id: "scurrius.rat", name: "Giant rat (Scurrius)", group: "Scurrius", npcTypeId: npcTypeIds.rat, size: 2, attackSpeed: 4, // TABLE
    attacks: [{ style: "melee", range: 1, clip: "attack" }], // TABLE: up to 4, slash
    idleSeqId: seqIds.ratIdle, walkSeqId: seqIds.ratWalk, deathSeqId: seqIds.ratDeath, clips: { attack: seqIds.ratAttack },
  },
];
