// The Mad Angel's sounds that are in no animation (ids.js, soundIds): the game's
// server sends each, so here they are a rule, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: the rule answers `pass` to what is not its own.
// The sounds of her animations' frames are in the cache with them, and the
// scene plays those.
import { soundIds } from "./ids.js";

export const madAngelAudio = {
  layerName: "mad_angel",
  rules: {
    inferno_visual: {
      preloadIds: [soundIds.bounce, soundIds.bounceHit, soundIds.explosion],
      // What encounter.js attaches to its visual events: { id, position }, a sound on a tile, heard to 20 tiles (OBS).
      resolve({ madAngelSounds }) {
        if (!madAngelSounds?.length) return { kind: "pass" };
        return {
          kind: "play",
          sound: madAngelSounds.map(({ id, position }) => ({ id, delayCycles: 0, range: soundIds.range, position: [...position], channel: "area" })),
        };
      },
    },
  },
};
