// The sounds of the fight that are in no animation: the game's server sends
// each of them (OBS: the recordings' sounds, ids.js), so here they are rules,
// keyed by the type of a tick event (docs/ADDING-AN-ENCOUNTER.md, section 5,
// `audio`). The layers of all encounters hear every event: a rule answers
// `pass` to what is not its own. The sounds of the frames of her sequences
// are in the cache with them, and the scene plays those.
import { sounds } from "./ids.js";

const play = (played) => (played.length > 0 ? { kind: "play", sound: played } : { kind: "pass" });
// What the encounter attaches to its visual events (encounter.js, `visual`): { id, delayCycles? }.
const sound = ({ id, delayCycles = 0 }) => ({ id, delayCycles, channel: "sfx" });

export const nexAudio = {
  layerName: "nex",
  rules: {
    inferno_visual: {
      preloadIds: [...new Set(Object.values(sounds))],
      resolve({ nexSounds }) {
        return play((nexSounds ?? []).map(sound));
      },
    },
  },
};
