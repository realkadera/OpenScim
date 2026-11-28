// What draws the Leviathan: the default scene, with what it has to load. Its
// model and sequences, the pathfinder's, the orbs and the rocks are the game
// cache's (encounter.js names each). The rocks that have fallen are the loc
// they leave in the game, drawn from the fight's snapshot. Its five tails round
// the arena are drawn here alone: they are no actors of the fight. The arena is
// a bridge (encounter.js): the actors stand on its level, as Zebak's do on his.
import { buildScene } from "../shared/buildScene.js";
import { leviathanAudio } from "./audio.js";
import { bossStart, ids, leviathanKind, leviathanMapSquare, seqs, spots, tails, tailSeqs } from "./encounter.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// The rubble (loc 47590), turned as the rock that left it fell (OBS).
const rubbleScene = () => ({
  consumeEvents() {},
  update({ state }) {
    return (state.encounter?.state?.rubble ?? []).map(([x, y, rotation]) => {
      const id = `leviathan-rubble-${x}-${y}`;
      return {
        id, meshId: id, materialId: "osrs-npc", modelMatrix: identity, lifecycle: { kind: "sync" }, classification: "sceneMesh",
        data: { kind: "loc", locId: ids.rubble, modelType: 10, rotation, localX: x, localY: y, level: 0, seqId: -1 },
      };
    });
  },
});

const renderConfig = {
  terrainMapSquare: leviathanMapSquare,
  // The arena's walls and the Scar's rocks stand on levels 0 and 1 (CACHE).
  locRender: { bounds: null, levels: [0, 1] },
  primaryNpc: { actorId: "leviathan", npcTypeId: ids.boss, basePosition: bossStart, size: 7, deathSeqId: seqs.death },
  preloadNpcTypes: [
    {
      npcTypeId: ids.boss, idleSeqId: seqs.idle, walkSeqId: seqs.idle, deathSeqId: seqs.death, bossDeathAnimationEnabled: true,
      attackClips: {
        spawn: seqs.spawn, orbStart: seqs.orbStart, orbLoop: seqs.orbLoop, orbSingle: seqs.orbSingle, roar: seqs.roar, bite: seqs.bite,
        stunned: seqs.stunned, lightningEnd: seqs.lightningEnd, spit: seqs.spit, blast: seqs.blast, orbEnd: seqs.orbEnd,
        // OBS: each sent once, and it goes on until the next (the loops 35 and 9
        // ticks). CACHE: the loops are a tick long with a frame step of 30, so the
        // client repeats them; the lightning's start has a frame step of 1, so it
        // holds its last frame the tick before its loop.
        lightning: { seqId: seqs.lightning, loops: true },
        lightningLoop: { seqId: seqs.lightningLoop, loops: true }, spitLoop: { seqId: seqs.spitLoop, loops: true },
      },
    },
    { npcTypeId: ids.pathfinder, idleSeqId: seqs.pathfinderIdle, walkSeqId: seqs.pathfinderIdle, attackClips: { spawn: seqs.pathfinderSpawn } },
    { npcTypeId: ids.tornado, idleSeqId: seqs.tornado, walkSeqId: seqs.tornado },
    ...Object.entries(tailSeqs).map(([npcTypeId, { idle, bite, weakSpot }]) => ({ npcTypeId: Number(npcTypeId), idleSeqId: idle, walkSeqId: idle, attackClips: { bite, weakSpot } })),
  ],
  spotAnimIds: [...new Set(Object.values(spots).flatMap((value) => (typeof value === "number" ? [value] : Object.values(value))))],
  createSceneObjectController: rubbleScene,
};

// A scene whose actors, rocks and ground effects stand on the raised surface
// where the cache marks a bridge (tile render flag 2 of level 1): the fight's,
// and the sandbox's on the Scar (sandbox/presentation.js).
export const onTheBridge = (BaseScene) =>
  class extends BaseScene {
    setTerrainHeightsAndBounds(map, bounds) {
      const heights = map.tileHeights[0].map((column, x) => column.map((height, y) => (map.tileRenderFlags[1]?.[x]?.[y] & 2 ? map.tileHeights[1][x][y] : height)));
      return super.setTerrainHeightsAndBounds({ ...map, tileHeights: [heights, ...map.tileHeights.slice(1)] }, bounds);
    }
  };

// With its tails: NPCs of the scene alone, which the visual events of the fight
// name (encounter.js, animateTails).
const withTails = (BaseScene) =>
  class extends BaseScene {
    syncNpcInstances(npcs, hidden, state, ...rest) {
      const boss = npcs.find((npc) => npc.npcTypeId === ids.boss);
      const drawn = boss ? tails.map((tail) => ({ ...boss, ...tail, position: [...tail.position], previousPosition: [...tail.position], lockedFacing: tail.facing, role: "npc", alive: true, deathTick: undefined, despawnTick: undefined, combatTargetId: null })) : [];
      return super.syncNpcInstances([...npcs, ...drawn], hidden, state, ...rest);
    }
  };

export const leviathanPresentation = (BaseScene) => ({
  kind: leviathanKind,
  renderConfig,
  sceneBuilder(context) {
    return buildScene(withTails(onTheBridge(BaseScene)), renderConfig, context);
  },
  audio: leviathanAudio,
  // The player comes in west of the pool and looks east at it. The recordings
  // have no camera: set in the browser (1280 x 850), steep and far enough that
  // its head is below the health bar from both versions' starts.
  defaultCamera: { yaw: 270, pitch: -56, zoom: 265 },
  presentation: {
    title: "The Leviathan",
    tagline: "Desert Treasure II",
    setupContext: "The Scar",
    blurb: "Pray against its volleys of orbs and step out from under the rocks of its roars. Stun it with a shadow spell and hit its back for its specials; once enraged, keep to the pathfinder.",
    wikiUrl: "https://oldschool.runescape.wiki/w/The_Leviathan/Strategies",
    portrait: { npcTypeId: ids.boss, framing: { yaw: -20, pitch: -10, focusHeight: 0.5, span: 0.85 } },
  },
});
// How presentations.js finds it.
export { leviathanPresentation as presentation };
