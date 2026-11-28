// What draws Brutus and Demonic Brutus: the default scene, with their sequences and spot animations, and Brutus's audio
// layer (audio.js). The ids are the game cache's (ids.js); the clip names are the ones encounter.js and demonic.js
// play. Each version has its own render config: the scene draws the boss as the type its config names.
import { buildScene } from "../shared/buildScene.js";
import { brutusKind, brutusMapSquare, brutusMapSquareOffsets, bossActorId } from "./encounter.js";
import { demonicBrutusKind } from "./demonic.js";
import { npcTypeIds, seqIds, spotAnims, demonicSeqIds, orbSpotAnims, bossStart, bossSize, removedLocs } from "./ids.js";
import { brutusAudio } from "./audio.js";

const renderConfig = {
  terrainMapSquare: brutusMapSquare,
  mapSquareOffsets: brutusMapSquareOffsets,
  locRender: { excludedLocs: removedLocs },
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.brutus, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.brutus,
      idleSeqId: seqIds.idle,
      attackClips: {
        spawn: seqIds.spawn,
        attack: seqIds.attack,
        stomp: seqIds.stomp,
        charge: seqIds.charge,
      },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
  ],
};

// Demonic Brutus (demonic.js): his clips, his ghosts', and phase 2's orbs.
const demonicRenderConfig = {
  terrainMapSquare: brutusMapSquare,
  mapSquareOffsets: brutusMapSquareOffsets,
  locRender: { excludedLocs: removedLocs },
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.demonic, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  spotAnimIds: [...new Set([...Object.values(spotAnims), ...Object.values(orbSpotAnims).flatMap((byStyle) => Object.values(byStyle))])],
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.demonic,
      idleSeqId: seqIds.idle,
      attackClips: {
        spawn: seqIds.spawn,
        attack: seqIds.attack,
        fadeOut: demonicSeqIds.fadeOut,
        chargeFadeIn: demonicSeqIds.chargeFadeIn,
        stompFadeIn: demonicSeqIds.stompFadeIn,
        chargeEndFadeIn: demonicSeqIds.chargeEndFadeIn,
      },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: npcTypeIds.demonicGhost,
      idleSeqId: seqIds.idle,
      attackClips: {
        ghostChargeFadeIn: demonicSeqIds.ghostChargeFadeIn,
        ghostStompFadeIn: demonicSeqIds.ghostStompFadeIn,
        ghostFadeOut: demonicSeqIds.ghostFadeOut,
      },
    },
  ],
};

const brutusPresentation = (BaseScene) => ({
  kind: brutusKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: brutusAudio,
  // The player comes in west of him: the camera looks east, toward him. inferred: to adjust in the browser.
  defaultCamera: { yaw: 512, pitch: -40, zoom: 420 },
  presentation: {
    title: "Brutus",
    tagline: "Lumbridge cow field",
    blurb: "His butts, three stomps to step back from, and a charge to step aside from.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Brutus",
    portrait: { npcTypeId: npcTypeIds.brutus, framing: { yaw: -30, pitch: -12, focusHeight: 0.5, span: 0.8 } },
  },
});
const demonicPresentation = (BaseScene) => ({
  kind: demonicBrutusKind,
  renderConfig: demonicRenderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, demonicRenderConfig, context),
  audio: brutusAudio,
  defaultCamera: { yaw: 512, pitch: -40, zoom: 420 },
});
export const presentations = [brutusPresentation, demonicPresentation];
