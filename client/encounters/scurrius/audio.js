// Scurrius' sounds that are in no animation. The game's server sends them, so
// here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`): his bolts and fur balls as
// he casts them and as they land on the player, the falling bricks, and his
// call of the rats. The layers of all encounters hear every event, so these
// answer his own alone: his attacks' kinds, his stomps and calls, and a
// landing he marks (`scurriusLanding`, encounter.js). The sounds of the frames
// of his animations and his rats' are in the cache with them, and the scene
// plays those.
//
// OBS (Encounter Recorder): four solo kills, rev 243 (ids.js); each count is of
// the times what the sound goes with came.
import { spotAnims, centreTile } from "./ids.js";
import { bossActorId, splashSpotAnim } from "./encounter.js";

// Played to the player alone.
const toPlayer = (id) => ({ id, channel: "sfx" });
// As he casts, on the tick of his cast (his attack's `kind`, encounter.js); a
// bolt's is heard on through its flight.
const castSounds = {
  scurrius_magic: toPlayer(7700), // 18 of 18 bolts
  scurrius_ranged: toPlayer(7722), // 17 of 17 fur balls
};
const landingSounds = {
  [spotAnims.magicImpact]: toPlayer(7670), // 7 of 8 bolts that hit
  [splashSpotAnim]: toPlayer(227), // 11 of 11 that splash
  [spotAnims.rangedImpact]: toPlayer(7696), // 15 of 15 fur balls
};

// Heard from the middle of the room (34,11, range 9), whatever tile he is on:
// each stomp's two sounds (24 of 24 stomps), and his call of the rats, 90
// cycles on (5 of 5 calls, at a pile or in the middle). Each tile of rubble: a
// sound sent with its graphic and played 240 cycles later, as the bricks land
// (267 of 290 tiles, range 5).
const fromTheMiddle = (id, delayCycles = 0) => ({ id, range: 9, position: [...centreTile], ...(delayCycles ? { delayCycles } : {}), channel: "area" });
const stompSounds = [fromTheMiddle(7699), fromTheMiddle(7667)];
const callSound = fromTheMiddle(7717, 90);
const brickSound = { id: 4175, range: 5, delayCycles: 240, channel: "area" };

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });

export const scurriusAudio = {
  layerName: "scurrius",
  rules: {
    zuk_attack: {
      preloadIds: Object.values(castSounds).map(({ id }) => id),
      resolve: ({ attack }) => play(Object.hasOwn(castSounds, attack) ? [castSounds[attack]] : []),
    },
    inferno_visual: {
      preloadIds: [...Object.values(landingSounds), ...stompSounds, callSound, brickSound].map(({ id }) => id),
      resolve({ animations = [], graphics = [], scurriusLanding = false }) {
        const his = (...clips) => animations.some(({ actorId, clipId }) => actorId === bossActorId && clips.includes(clipId));
        const stomps = his("stomp", "feedingStomp");
        return play([
          ...(stomps ? stompSounds : []),
          ...(stomps ? graphics.filter(({ spotAnimId }) => spotAnimId === spotAnims.debris).map(({ target }) => ({ ...brickSound, position: [...target.position] })) : []),
          ...(his("feedingSummon", "enragedSummon") ? [callSound] : []),
          ...(scurriusLanding ? graphics.filter(({ spotAnimId }) => Object.hasOwn(landingSounds, spotAnimId)).map(({ spotAnimId }) => landingSounds[spotAnimId]) : []),
        ]);
      },
    },
  },
};
