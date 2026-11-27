// The Alchemical Hydra in the sandbox (client/encounters/sandbox/): its
// catalog entry, in the format sandbox/catalog.js describes, from
// encounter.js and ids.js. It walks up to its target and attacks from up to
// 10 tiles, three of a style then the other, with its heads' sway as it
// switches (`rotation`). At three quarters, half and a quarter of its
// hitpoints a head falls and it takes its next form (`forms`): electric,
// flame and enraged, each with its own max hits, the enraged one every 4
// ticks and changing its style every attack. What is its chamber's is left
// out: the vents and the shield they lift, the poison pools, the lightning
// and the fire. Its own fight never reads this file.
import { npcTypeIds, seqIds, spotAnims } from "./ids.js";

// encounter.js: every flight starts at cycle 30 and ends 40 + 5 a tile from
// its south-west tile (OBS (tsps)); here as from 6 tiles (inferred), 30 high to 16.
const flight = (spotAnimId) => ({ spotAnimId, startDelayCycles: 30, endDelayCycles: 70, slope: 16, startOffset: 64, startHeight: 30, endHeight: 16 });
// The clips of a form (0 serpentine, 1 electric, 2 flame, 3 enraged: ids.js, seqIds).
const clipsOf = (phase) => ({
  range: seqIds.ranged[phase],
  magic: seqIds.magic[phase],
  switch: seqIds.switch[phase] ?? seqIds.ranged[phase],
  spawn: seqIds.phaseIn[phase - 1] ?? seqIds.idle[phase],
});
const formLoad = (phase, npcTypeId) => ({ npcTypeId, idleSeqId: seqIds.idle[phase], walkSeqId: seqIds.walk[phase], attackClips: clipsOf(phase), deathSeqId: seqIds.death });

export const alchemicalHydraSandboxEntries = [
  {
    // encounter.js: an attack every 6 ticks (WIKI, TABLE, OBS (tsps)), from up to
    // 10 tiles (reach); two projectiles of 17 a serpentine attack (WIKI, OBS (tsps)).
    id: "alchemical_hydra", name: "Alchemical Hydra", group: "Bosses", npcTypeId: npcTypeIds.serpentine, size: 6, attackSpeed: 6, // CACHE
    statsVersion: "Serpentine", // TABLE: its first form's set
    attacks: [
      { style: "range", range: 10, clip: "range", maxHit: 17, hits: 2, flight: flight(spotAnims.ranged) },
      { style: "magic", range: 10, clip: "magic", maxHit: 17, hits: 2, flight: flight(spotAnims.magic) },
    ],
    // encounter.js: three basic attacks a style, then the other (WIKI, OBS (tsps)), the heads swaying as it switches.
    rotation: { every: 3, styles: ["range", "magic"], switchClips: { range: "switch", magic: "switch" } },
    // encounter.js, phases: a head falls at 825, 550 and 275 of its 1,100 (WIKI),
    // and the next form comes with its max hits (styles), the enraged one
    // every 4 ticks with its style changing every attack (WIKI, OBS (tsps)).
    forms: [
      { belowFraction: 0.75, npcTypeId: npcTypeIds.electric, statsVersion: "Electric", clip: "spawn", attacks: { range: { maxHit: 35, hits: 1 }, magic: { maxHit: 17, hits: 2 } } },
      { belowFraction: 0.5, npcTypeId: npcTypeIds.flame, statsVersion: "Fire", clip: "spawn", attacks: { range: { maxHit: 35, hits: 1 }, magic: { maxHit: 35, hits: 1 } } },
      { belowFraction: 0.25, npcTypeId: npcTypeIds.enraged, statsVersion: "Extinguished", clip: "spawn", attackSpeed: 4, rotationEvery: 1, attacks: { range: { maxHit: 55, hits: 1 }, magic: { maxHit: 55, hits: 1 } } },
    ],
    alsoLoads: [formLoad(1, npcTypeIds.electric), formLoad(2, npcTypeIds.flame), formLoad(3, npcTypeIds.enraged)],
    idleSeqId: seqIds.idle[0], walkSeqId: seqIds.walk[0], deathSeqId: seqIds.death, clips: clipsOf(0),
  },
];
