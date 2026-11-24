// The gaze's sounds that are in no animation. The game's server sends them, so
// here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of his animations' frames (his roars, the eye, the slam) are in
// the cache with them, and the scene plays those.
//
// OBS 11/24 as in encounter.js, CACHE names a sound in its table of names. A
// gaze that finds the player was not recorded, so it has no sound of its own.

// OBS 11/24 (11 of 11): sent as the gaze starts, with no place. CACHE:
// dt2_duke_sight_attack_charge_01.
const gazeSoundId = 7215;
// OBS 11/24 (11 of 11): sent as the player is told they avoided it, with no
// place. CACHE: ice_barrage_impact.
const avoidedSoundId = 168;

const bossActorId = "duke-sucellus";

export const dukeAudio = {
  layerName: "dukeSucellus",
  rules: {
    inferno_visual: {
      preloadIds: [gazeSoundId, avoidedSoundId],
      resolve(event) {
        if (event.gazeAvoided) return { kind: "play", sound: { id: avoidedSoundId, channel: "sfx" } };
        if (event.animations?.some(({ actorId, clipId }) => actorId === bossActorId && clipId === "gaze")) return { kind: "play", sound: { id: gazeSoundId, channel: "sfx" } };
        return { kind: "pass" };
      },
    },
  },
};
