// What draws the Mad Angel: the default scene, with her sequences and the spot
// animations of her specials, and her audio layer (audio.js). The ids are the game cache's (ids.js); the clip
// names are the ones encounter.js plays.
import { buildScene } from "../shared/buildScene.js";
import { madAngelKind, madAngelMapSquare, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, bossStart, bossSize } from "./ids.js";
import { madAngelAudio } from "./audio.js";

const sweepClips = Object.fromEntries(
  Object.entries(seqIds.sweep).flatMap(([side, clips]) => Object.entries(clips).map(([step, seqId]) => [`sweep_${side}_${step}`, seqId])),
);

const renderConfig = {
  terrainMapSquare: madAngelMapSquare,
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.madAngel, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.madAngel,
      idleSeqId: seqIds.idle,
      attackClips: {
        wake: seqIds.wake,
        melee: seqIds.melee,
        blast: seqIds.blast,
        smite: seqIds.smite,
        smite_enraged: seqIds.smiteEnraged,
        ...sweepClips,
      },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
  ],
};

export const presentation = (BaseScene) => ({
  kind: madAngelKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: madAngelAudio,
  // The player comes in east of her: the camera looks west, toward her. inferred: to adjust in the browser.
  defaultCamera: { yaw: 1536, pitch: -40, zoom: 420 },
  presentation: {
    title: "Mad Angel",
    tagline: "Ardeaglais",
    blurb: "Her sword sweeps, the ball of light to bounce back, the smite to pray against on the tick, and her enrage.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Mad_Angel",
    portrait: { npcTypeId: npcTypeIds.madAngel, framing: { yaw: -30, pitch: -12, focusHeight: 0.5, span: 0.8 } },
  },
});
