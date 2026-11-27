// Vorkath's sounds that are in no animation. The game's server sends them, so
// here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
//
// OBS (REC): the three recordings of encounter.js, 7 kills. Each sound is
// there every time what it goes with is, and the count is of those, unless it
// says otherwise. The delays are the recorded ones, in cycles. Not here: the
// poke (2581), which the fight has no moment for, and the player's own sounds.
import { bossActorId, spawnActorId } from "./encounter.js";
import { spotAnims } from "./ids.js";

// With no place: as loud wherever the player stands.
const everywhere = (id, delayCycles = 0) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" });
// Heard from a tile.
const from = (id, range, position, delayCycles = 0) => ({ id, range, channel: "area", ...(delayCycles ? { delayCycles } : {}), position: [...position] });

// A shot or a breath: as she starts it, as it leaves, and its impact as it
// lands (the flight's end: 80, 85 or 90 cycles in the recordings).
const shotStart = everywhere(408, 10); // 76 of 76 ranged and magic shots
const breathStart = everywhere(3750, 15); // 72 of 72 breaths, the icy one among them
const launches = {
  vorkath_ranged: [shotStart, everywhere(1965, 20)], // 31 of 31
  vorkath_magic: [shotStart, everywhere(222, 20)], // 45 of 45
  vorkath_dragonfire: [breathStart, everywhere(585)], // 26 of 26
  vorkath_venom: [breathStart, everywhere(587)], // 21 of 21
  vorkath_prayer: [breathStart, everywhere(284)], // 14 of 14
  vorkath_ice: [breathStart, everywhere(586)], // 11 of 11
};
const impacts = { vorkath_ranged: 3403, vorkath_magic: 223, vorkath_dragonfire: 156, vorkath_venom: 129, vorkath_prayer: 135, vorkath_ice: 168 };
const meleeSound = everywhere(1521); // 16 of 16

const wakeSounds = [everywhere(1522, 25), everywhere(1518, 115)]; // 7 of 7 each
const fireballSound = everywhere(1519, 20); // 21 of 21, as she rears up
const acidSound = everywhere(736, 20); // 15 of 15
const rapidSound = everywhere(3749, 2); // 367 of 367 shots
const throwSound = everywhere(1784, 28); // 11 of 11, as she throws the spawn
const explodeSounds = [everywhere(232), everywhere(208, 22)]; // the one explosion recorded
const hitSound = everywhere(410); // 388 of 400 hits on her, of 0 too
const deathSound = everywhere(1523); // 7 of 7
const spawnHitSound = everywhere(231); // 10 of 10, with the hit that kills it

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });
const ids = (...sounds) => sounds.flat(Infinity).map(({ id }) => id);

export const vorkathAudio = {
  layerName: "vorkath",
  rules: {
    zuk_attack: {
      preloadIds: [...ids(Object.values(launches), meleeSound), ...Object.values(impacts)],
      resolve({ attack, projectileArrivalCycles = 80 }) {
        if (attack === "vorkath_melee") return play([meleeSound]);
        if (!Object.hasOwn(launches, attack)) return play([]);
        return play([...launches[attack], everywhere(impacts[attack], projectileArrivalCycles)]);
      },
    },
    inferno_visual: {
      // 163: the fireball on its tile (21 of 21); 3308: each pool of acid as it lands (748 of 748); 158: each shot of
      // rapid fire on its tile (366 of 366); 232: the spawn as it lands (11 of 11).
      preloadIds: [...ids(wakeSounds, fireballSound, acidSound, rapidSound, throwSound, explodeSounds), 163, 3308, 158, 232],
      resolve({ animations = [], projectiles = [], graphics = [] }) {
        const starts = (clip, actor = bossActorId) => animations.some(({ actorId, clipId }) => actorId === actor && clipId === clip);
        const thrown = (id) => projectiles.filter(({ spotAnimId, target }) => spotAnimId === id && target?.kind === "tile");
        const drawn = (id) => graphics.filter(({ spotAnimId, target }) => spotAnimId === id && target?.kind === "tile");
        return play([
          ...(starts("wake") ? wakeSounds : []),
          ...(starts("high") ? [fireballSound] : []),
          ...(starts("acid") ? [acidSound] : []),
          ...(starts("explode", spawnActorId) ? explodeSounds : []),
          ...(thrown(spotAnims.rapid).length > 0 ? [rapidSound] : []),
          ...(thrown(spotAnims.spawnThrown).length > 0 ? [throwSound] : []),
          ...thrown(spotAnims.spawnThrown).map(({ target, endDelayCycles }) => from(232, 16, target.position, endDelayCycles)),
          ...thrown(spotAnims.acid).map(({ target, endDelayCycles }) => from(3308, 5, target.position, endDelayCycles)),
          ...drawn(spotAnims.rapidImpact).map(({ target, delayCycles }) => from(158, 12, target.position, delayCycles)),
          ...drawn(spotAnims.dragonfireImpact).map(({ target, delayCycles }) => from(163, 12, target.position, delayCycles)),
        ]);
      },
    },
    // A hit on her; and on the spawn, whose going is heard from its tile 3 ticks on (230, range 12: 10 of 10 kills).
    // Here with any hit that hurts it: Crumble Undead, which the recordings killed it with, kills at once.
    hit_applied: {
      preloadIds: [hitSound.id, spawnHitSound.id, 230],
      resolve({ targetId, targetPosition, damage }) {
        if (targetId === bossActorId) return play([hitSound]);
        if (targetId === spawnActorId && damage > 0) return play([spawnHitSound, from(230, 12, targetPosition, 90)]);
        return play([]);
      },
    },
    actor_died: {
      preloadIds: [deathSound.id],
      resolve: ({ actorId }) => play(actorId === bossActorId ? [deathSound] : []),
    },
  },
};
