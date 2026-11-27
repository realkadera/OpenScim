// What draws Nex: the default scene in her chamber, her sequences, her mages,
// reavers and the stalagmites of her prison, the teammates (player-like NPCs
// of the cache, ids.js), and what lies on the floor: her shadows, her
// containment's icicles and an ice prison's middle and stalagmites (map
// objects the game uses for them, drawn from the encounter's snapshot). The ids are the game
// cache's (ids.js).
import { buildScene } from "../shared/buildScene.js";
import { nexAudio } from "./audio.js";
import { nexKind, nexMapSquare, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, locIds, bossStart, bossSize } from "./ids.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const loc = (prefix, locId, [x, y]) => ({
  id: `${prefix}-${x}-${y}`,
  meshId: `${prefix}-${x}-${y}-${locId}`,
  materialId: "osrs-npc",
  modelMatrix: identity,
  lifecycle: { kind: "sync" },
  classification: "groundDecal",
  data: { kind: "loc", locId, modelType: 10, rotation: 0, localX: x, localY: y, level: 0, seqId: -1 },
});
const floorObjects = () => ({
  consumeEvents() {},
  update({ state }) {
    const chamber = state.encounter?.state;
    if (!chamber) return [];
    return [
      ...(chamber.shadows ?? []).map(({ tile }) => loc("nex-shadow", locIds.shadow, tile)),
      ...(chamber.spentShadows ?? []).map((tile) => loc("nex-shadow", locIds.shadowSpent, tile)),
      ...(chamber.icicles ?? []).map((tile) => loc("nex-icicle", locIds.icicle, tile)),
      ...(chamber.icicleRing ?? []).map((tile) => loc("nex-icicle", locIds.icicleOuter, tile)),
      ...(chamber.prison ? [loc("nex-prison", locIds.icicle, chamber.prison.tile)] : []),
      // OBS: the stalagmites are objects (42944); they are drawn so over their stand-in NPCs, which the player can hit.
      ...(chamber.prison?.stalagmites ?? []).map((tile) => loc("nex-stalagmite", locIds.prisonWall, tile)),
    ];
  },
});

const bossClips = {
  melee: seqIds.melee, magic: seqIds.magic, cast: seqIds.cast, dash: seqIds.dash, jump: seqIds.jump, darkness: seqIds.darkness,
  smash: seqIds.smash, siphon: seqIds.siphon, zaros: seqIds.zaros,
};
const nex = (npcTypeId) => ({
  npcTypeId, idleSeqId: seqIds.idle, walkSeqId: seqIds.walk, attackClips: bossClips, deathSeqId: seqIds.death, bossDeathAnimationEnabled: true,
});
const mage = (npcTypeId) => ({ npcTypeId, idleSeqId: seqIds.mageIdle, attackClips: { cast: seqIds.mageCast }, deathSeqId: seqIds.mageDeath });
const teammate = (npcTypeId) => ({
  npcTypeId, idleSeqId: seqIds.mateIdle, walkSeqId: seqIds.mateRun,
  attackClips: { shoot: seqIds.mateCrossbow, stab: seqIds.mateStab, death: seqIds.mateDeath }, deathSeqId: seqIds.mateDeath,
});

const renderConfig = {
  terrainMapSquare: nexMapSquare,
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.nex, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  preloadNpcTypes: [
    nex(npcTypeIds.nexRising),
    nex(npcTypeIds.nex),
    nex(npcTypeIds.nexSoulSplit), nex(npcTypeIds.nexDeflect), nex(npcTypeIds.nexDying),
    mage(npcTypeIds.fumus), mage(npcTypeIds.umbra), mage(npcTypeIds.cruor), mage(npcTypeIds.glacies),
    { npcTypeId: npcTypeIds.reaver, idleSeqId: seqIds.reaverIdle, walkSeqId: seqIds.reaverWalk, attackClips: { cast: seqIds.reaverCast }, deathSeqId: seqIds.reaverDeath },
    { npcTypeId: npcTypeIds.stalagmite, attackClips: {} },
    teammate(npcTypeIds.rangerMate),
  ],
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  createSceneObjectController: floorObjects,
};

export const nexPresentation = (BaseScene) => ({
  kind: nexKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: nexAudio,
  // inferred: looking north over her from the player's start, west of her.
  defaultCamera: { yaw: 0, pitch: -45, zoom: 520 },
  presentation: {
    title: "Nex",
    tagline: "Ancient Prison",
    setupContext: "Nex's chamber",
    blurb: "Five phases with a team: her virus and smoke dash, darkness and shadows, siphon and blood sacrifice, containment and ice prison, then the power of Zaros and her wrath.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Nex/Strategies",
    portrait: { npcTypeId: npcTypeIds.nex, framing: { yaw: -20, pitch: -10, focusHeight: 0.6, span: 0.8 } },
  },
});
// How presentations.js finds it.
export { nexPresentation as presentation };
