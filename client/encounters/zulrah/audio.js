// CACHE and OBS (Outside.wiki phas3r and boulder-bros recordings):
// Zulrah sound effects for ranged, magic, venom clouds, snakelings, dive, and rise.

const attackSounds = {
  zulrah_ranged: { launch: 213, impact: 214 },
  zulrah_magic: { launch: 162, impact: 163 },
  snakeling_magic: { launch: 224, impact: 794 },
  snakeling_melee: { impact: 794 },
};

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });

// Sound object builder
const sound = ({ id, delayCycles = 0, range = 15, position }) =>
  position
    ? { id, delayCycles, range, position: [...position], channel: "area" }
    : { id, delayCycles, channel: "sfx" };

const allPreloadIds = [
  213, 214, 162, 163, 224, 794, // Attacks
  2685, 2675, // Rise, Dive
  796, 790, 795, // Venom spit, land, dissipate
  788, 1930, // Snakeling spit, land
  2766, 2767, 2768, 2769, 2770, // Snakeling audio
];

export const zulrahAudio = {
  layerName: "zulrah",
  rules: {
    zuk_attack: {
      preloadIds: allPreloadIds,
      resolve({ attack, targetPosition, projectileArrivalCycles }) {
        if (!Object.hasOwn(attackSounds, attack)) return { kind: "pass" };
        const conf = attackSounds[attack];
        const audio = [];
        if (conf.launch) {
          audio.push({ id: conf.launch, delayCycles: 0, channel: "sfx" });
        }
        if (conf.impact) {
          const delayCycles = projectileArrivalCycles ?? 0;
          if (targetPosition) {
            audio.push({ id: conf.impact, delayCycles, range: 7, position: [...targetPosition], channel: "area" });
          } else {
            audio.push({ id: conf.impact, delayCycles, channel: "sfx" });
          }
        }
        return play(audio);
      },
    },
    inferno_visual: {
      preloadIds: allPreloadIds,
      resolve({ zulrahSounds }) {
        return play((zulrahSounds ?? []).map(sound));
      },
    },
  },
};
