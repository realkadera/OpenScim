// The sounds of the fight that are in no animation. The game's server sends
// each of them, so here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of the frames of her sequences are in the cache with them, and
// the scene plays those.
//
// tsps, as in encounter.js: each sound's id and delay.
import { sounds } from "./ids.js";

const impactSounds = {
  phosanis_nightmare_magic: sounds.magicImpact, // on the player as it lands
  phosanis_nightmare_range: sounds.rangeImpact,
};

const play = (played) => (played.length > 0 ? { kind: "play", sound: played } : { kind: "pass" });
// What the encounter attaches to its visual events (encounter.js, `visual`):
// { id, delayCycles?, range?, position? }, a sound on a tile when it has a position.
const sound = ({ id, delayCycles = 0, range, position }) =>
  position ? { id, delayCycles, range: range ?? 1, position: [...position], channel: "area" } : { id, delayCycles, channel: "sfx" };

export const phosanisNightmareAudio = {
  layerName: "phosanis_nightmare",
  rules: {
    zuk_attack: {
      preloadIds: Object.values(impactSounds),
      resolve({ attack, projectileArrivalCycles }) {
        if (!Object.hasOwn(impactSounds, attack)) return { kind: "pass" };
        return play([{ id: impactSounds[attack], delayCycles: projectileArrivalCycles ?? 0, channel: "sfx" }]);
      },
    },
    inferno_visual: {
      preloadIds: Object.values(sounds),
      resolve({ nightmareSounds }) {
        return play((nightmareSounds ?? []).map(sound));
      },
    },
  },
};
