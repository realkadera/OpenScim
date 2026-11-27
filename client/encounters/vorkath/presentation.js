// What draws Vorkath: the default scene, with her sequences and her spawn's, the
// spot animations of her attacks, and the acid on the floor as the map object
// the game uses for it (from the encounter's snapshot). The ids are the game
// cache's (ids.js).
import { buildScene } from "../shared/buildScene.js";
import { vorkathKind, vorkathMapSquare, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, acidPoolLoc, bossStart, bossSize } from "./ids.js";
import { vorkathAudio } from "./audio.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const acid = ([x, y]) => ({
  id: `vorkath-acid-${x}-${y}`,
  meshId: `vorkath-acid-${x}-${y}`,
  materialId: "osrs-npc",
  modelMatrix: identity,
  lifecycle: { kind: "sync" },
  classification: "groundDecal",
  data: { kind: "loc", locId: acidPoolLoc, modelType: 10, rotation: (x * 7 + y) % 4, localX: x, localY: y, level: 0, seqId: -1 },
});
const floorObjects = () => ({
  consumeEvents() {},
  update({ state }) {
    return (state.encounter.state.acidPools ?? []).map(acid);
  },
});

const renderConfig = {
  terrainMapSquare: vorkathMapSquare,
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.vorkath, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  createSceneObjectController: floorObjects,
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.vorkath,
      idleSeqId: seqIds.idle,
      attackClips: { wake: seqIds.wake, melee: seqIds.melee, breath: seqIds.breath, acid: seqIds.acid, high: seqIds.high, throw: seqIds.high },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: npcTypeIds.spawn,
      idleSeqId: seqIds.spawnIdle,
      walkSeqId: seqIds.spawnWalk,
      attackClips: { explode: seqIds.spawnExplode, land: seqIds.spawnLand },
      deathSeqId: seqIds.spawnDeath,
    },
  ],
};

export const presentation = (BaseScene) => ({
  kind: vorkathKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: vorkathAudio,
  // The player comes in south of her: the camera looks north, over his shoulder.
  defaultCamera: { yaw: 0, pitch: -40, zoom: 420 },
  presentation: {
    title: "Vorkath",
    tagline: "Ungael",
    blurb: "Breaths, a fireball to step off, acid and rapid fire, and the zombified spawn.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Vorkath",
    portrait: { npcTypeId: npcTypeIds.vorkath, framing: { yaw: -30, pitch: -12, focusHeight: 0.5, span: 0.8 } },
  },
});
