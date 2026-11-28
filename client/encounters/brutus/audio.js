// Brutus's sounds that are in no animation (ids.js, soundIds): the snort before a stomp and the growl before a charge.
// The game's server sends each, so here they are a rule, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all encounters hear every event: the rule answers
// `pass` to what is not its own. The sounds of his animations' frames are in the cache with them, and the scene plays
// those.
import { soundIds } from "./ids.js";

export const brutusAudio = {
  layerName: "brutus",
  rules: {
    inferno_visual: {
      preloadIds: [soundIds.snort, soundIds.growl],
      // What encounter.js attaches to its visual events: { id, position }, a sound on his tile.
      resolve({ brutusSounds }) {
        if (!brutusSounds?.length) return { kind: "pass" };
        return {
          kind: "play",
          sound: brutusSounds.map(({ id, position }) => ({ id, delayCycles: 0, range: soundIds.range, position: [...position], channel: "area" })),
        };
      },
    },
  },
};
