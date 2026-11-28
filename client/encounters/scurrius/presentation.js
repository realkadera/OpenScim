// What draws Scurrius: the default scene, with his sequences and his rats',
// and the spot animations of his attacks; his sounds that are in no animation
// (audio.js). The ids are the game cache's (ids.js).
import { buildScene } from "../shared/buildScene.js";
import { scurriusAudio } from "./audio.js";
import { scurriusKind, scurriusMapSquare, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, bossStart, bossSize } from "./ids.js";

const renderConfig = {
  terrainMapSquare: scurriusMapSquare,
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.solo, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  spotAnimIds: [...new Set([...Object.values(spotAnims), 85])], // 85: a bolt's splash (encounter.js)
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.solo,
      idleSeqId: seqIds.idle,
      walkSeqId: seqIds.walk,
      attackClips: {
        // His run: the scene has a walk of his type alone, so a run is played as a clip each tick of it (encounter.js).
        run: seqIds.run,
        melee: seqIds.melee,
        ranged: seqIds.ranged,
        magic: seqIds.magic,
        stomp: seqIds.stomp,
        feedingRanged: seqIds.feedingRanged,
        feedingMagic: seqIds.feedingMagic,
        feedingStomp: seqIds.feedingStomp,
        feedingSummon: seqIds.feedingSummon,
        enragedSummon: seqIds.enragedSummon,
      },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: npcTypeIds.rat,
      idleSeqId: seqIds.ratIdle,
      walkSeqId: seqIds.ratWalk,
      attackClips: { attack: seqIds.ratAttack },
      deathSeqId: seqIds.ratDeath,
    },
  ],
};

export const presentation = (BaseScene) => ({
  kind: scurriusKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  // The player comes in from the west: the camera looks east, over his shoulder.
  defaultCamera: { yaw: 270, pitch: -45, zoom: 360 },
  audio: scurriusAudio,
  presentation: {
    title: "Scurrius",
    tagline: "Varrock Sewers",
    blurb: "Tail swipes, food piles, bolts and fur balls, falling bricks and giant rats.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Scurrius",
    portrait: { npcTypeId: npcTypeIds.solo, framing: { yaw: -30, pitch: -12, focusHeight: 0.5, span: 0.8 } },
  },
});
