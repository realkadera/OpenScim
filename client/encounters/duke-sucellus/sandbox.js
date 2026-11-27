// Duke Sucellus in the sandbox (client/encounters/sandbox/): his catalog
// entry, in the format sandbox/catalog.js describes. He never leaves his seat
// (immobile, wherever he is placed); his slam beside him and his magic are
// his own, from encounter.js, and so is his enrage. What is his asylum's is
// left out: the gaze (dodged only behind its pillars), the gas of its vents
// and the ice. His own fight never reads this file.
import { ids, seqs, spots, versions } from "./encounter.js";

const { slamMaxHit, magicMaxHit, maxHp, enrageHp } = versions.postQuest; // WIKI (encounter.js)

export const dukeSucellusSandboxEntries = [
  {
    id: "duke_sucellus", name: "Duke Sucellus", group: "Bosses", npcTypeId: ids.boss, size: 7, attackSpeed: 5, immobile: true, // WIKI, TABLE
    attacks: [
      // encounter.js: the slam comes down 2 ticks after the icicles, beside him (OBS).
      { style: "melee", range: 1, clip: "melee", maxHit: slamMaxHit, impactDelayTicks: 2, targetGraphic: { spotAnimId: spots.meleeRow[3], height: 0 } },
      // encounter.js: the magic projectile, landing 4 ticks after the cast (OBS).
      { style: "magic", range: 20, clip: "magic", maxHit: magicMaxHit, flight: { spotAnimId: spots.magicProjectile, startDelayCycles: 50, endDelayCycles: 120, slope: 5, startOffset: 0, startHeight: 350, endHeight: 100 } },
    ],
    // encounter.js: an attack every 4 ticks once enraged, at 126 of his 485 (OBS).
    enrage: { belowFraction: enrageHp / maxHp, attackSpeed: 4 },
    idleSeqId: seqs.idle, deathSeqId: seqs.death, clips: { melee: seqs.melee, magic: seqs.magic },
  },
];
