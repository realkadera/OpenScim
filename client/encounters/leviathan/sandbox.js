// The Leviathan in the sandbox (client/encounters/sandbox/): its catalog
// entry, in the format sandbox/catalog.js describes. It never leaves its pool
// (immobile, wherever it is placed); its orbs of three styles and its bite
// are its own, from encounter.js. What is its arena's is left out: the
// pool's edge, the falling rocks, the lightning, the smoke and the
// pathfinder's weak spot. Its own fight never reads this file.
import { ids, seqs, spots, versions } from "./encounter.js";

const maxHits = versions.postQuest; // WIKI (encounter.js): its infobox
// encounter.js: an orb from 550 high to 100, slope 30, 124 out from the
// mouth; it lands after 3 ticks, as in its middle volleys (OBS).
const orb = (style) => ({ spotAnimId: spots.orb[style], startDelayCycles: 30, endDelayCycles: 90, slope: 30, startOffset: 124, startHeight: 550, endHeight: 100 });

export const leviathanSandboxEntries = [
  {
    // attackSpeed 2: an orb every 2 ticks, its second and third volleys (encounter.js, volleys).
    id: "leviathan", name: "The Leviathan", group: "Bosses", npcTypeId: ids.boss, size: 7, attackSpeed: 2, immobile: true,
    attacks: [
      { style: "magic", range: 30, clip: "orb", maxHit: maxHits.orbMaxHit.magic, flight: orb("magic") },
      { style: "range", range: 30, clip: "orb", maxHit: maxHits.orbMaxHit.range, flight: orb("range") },
      // encounter.js: melee orbs from its third volley on; here every third orb (inferred).
      { style: "melee", range: 30, clip: "orb", maxHit: maxHits.orbMaxHit.melee, flight: orb("melee"), everyNth: 3 },
      // Its bite, beside it (encounter.js: beside the pool).
      { style: "melee", range: 1, clip: "bite", maxHit: maxHits.biteMaxHit },
    ],
    idleSeqId: seqs.idle, deathSeqId: seqs.death, clips: { orb: seqs.orbStart, bite: seqs.bite },
  },
];
