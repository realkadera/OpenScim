// What draws Phosani's Nightmare: the default scene on the dream's plane 3,
// each of her forms with its sequences, the totems, husks, parasites and
// sleepwalkers, and the spores and corpse flowers she plants (map objects
// drawn from the encounter's snapshot). The ids are the game cache's (ids.js).
import { buildScene } from "../shared/buildScene.js";
import { phosanisNightmareAudio } from "./audio.js";
import { phosanisNightmareKind, phosanisNightmareMapSquare, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, locIds, locSeqIds, bossStart, bossSize, plane } from "./ids.js";

// The height of a plane's terrain under a point (its tile corners' heights, [x][y], blended), as the scene finds its own.
const heightAt = (heights, x, y) => {
  const tx = Math.max(0, Math.min(63, Math.floor(x)));
  const ty = Math.max(0, Math.min(63, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - tx));
  const fy = Math.max(0, Math.min(1, y - ty));
  const at = (dx, dy) => heights[tx + dx]?.[ty + dy] ?? 0;
  const south = at(0, 0) + (at(1, 0) - at(0, 0)) * fx;
  const north = at(0, 1) + (at(1, 1) - at(0, 1)) * fx;
  return south + (north - south) * fy;
};
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
// CACHE: spores and flowers are locs of shape 10, unturned, one a tile.
const loc = (id, locId, [x, y], seqId = -1, animationStartTick) => ({
  id,
  meshId: `${id}-${locId}`,
  materialId: "osrs-npc",
  modelMatrix: identity,
  lifecycle: { kind: "sync" },
  classification: "sceneMesh",
  data: { kind: "loc", locId, modelType: 10, rotation: 0, localX: x, localY: y, level: plane, seqId, ...(animationStartTick === undefined ? {} : { animationStartTick }) },
});
// tsps: the flowers' ids by stage (planted, ready, open), and their sequences.
const flowerStage = { planted: 0, ready: 1, opening: 1, active: 2, withering: 2 };
const flowerSeq = { planted: "spawn", opening: "active", withering: "despawn" };
const dreamObjects = () => ({
  consumeEvents() {},
  update({ state }) {
    const dream = state.encounter?.state;
    if (!dream) return [];
    const drawn = [];
    for (const [x, y] of dream.spores?.tiles ?? []) {
      if (!dream.spores.planted) continue;
      drawn.push(loc(`nightmare-spore-${x}-${y}`, dream.spores.armed ? locIds.sporeArmed : locIds.spore, [x, y], dream.spores.armed ? -1 : locSeqIds.sporeGrow, dream.spores.start + 2));
    }
    for (const { tile: [x, y], at } of dream.spores?.bursting ?? []) {
      if (dream.spores && at >= (state.tick ?? at) - 2) drawn.push(loc(`nightmare-spore-${x}-${y}`, locIds.sporeArmed, [x, y], locSeqIds.sporeBurst, at));
    }
    const flowers = dream.flowers;
    if (flowers && flowerStage[flowers.stage] !== undefined) {
      for (const { tile: [x, y], safe } of flowers.tiles) {
        const ids = safe ? locIds.flowerSafe : locIds.flowerBerry;
        const seqs = safe ? locSeqIds.flowerSafe : locSeqIds.flowerBerry;
        const seq = flowerSeq[flowers.stage];
        drawn.push(loc(`nightmare-flower-${x}-${y}`, ids[flowerStage[flowers.stage]], [x, y], seq ? seqs[seq] : -1));
      }
    }
    return drawn;
  },
});

// Her forms: the same sequences in every one (OBS (Outside): they stand with 8593 and walk with 8592; her blast form
// stands with 8603; asleep she stands with 8613), her death in her last.
const bossClips = {
  wake: seqIds.wake,
  magic: seqIds.magic, range: seqIds.range, melee: seqIds.melee, claws: seqIds.claws,
  clawRunStart: seqIds.clawRunStart, clawRun: seqIds.clawRun, clawRunEnd: seqIds.clawRunEnd,
  husks: seqIds.husks, parasite: seqIds.parasite, curse: seqIds.curse, spores: seqIds.spores, flowers: seqIds.flowers,
  leave: seqIds.leave, back: seqIds.back, surge: seqIds.surge, blastForm: seqIds.blastForm, blast: seqIds.blast, death: seqIds.death,
};
const form = (npcTypeId, idleSeqId = seqIds.idle) => ({ npcTypeId, idleSeqId, walkSeqId: seqIds.walk, deathSeqId: seqIds.death, bossDeathAnimationEnabled: true, attackClips: bossClips });
const totemTypes = Object.values(npcTypeIds.totems).flatMap(([dormant, ready, charged]) => [
  { npcTypeId: dormant, attackClips: {} },
  { npcTypeId: ready, attackClips: {} },
  { npcTypeId: charged, idleSeqId: seqIds.totemCharged, attackClips: {} },
]);
const { husk, parasite_: parasite, sleepwalker } = seqIds;

const renderConfig = {
  terrainMapSquare: phosanisNightmareMapSquare,
  // CACHE: the player stands on plane 3, whose floor is a dark grey overlay (126) with holes (overlay 42) all round
  // it. The floor's tiles and lines are objects of plane 2 at the same height, the totems' pillars stand on planes 0
  // and 1, and the dream's rocks and ground are on plane 0, 1,240 below: every plane is drawn, each at its own height.
  locRender: { bounds: null, levels: [0, 1, 2, 3] },
  primaryNpc: { actorId: bossActorId, npcTypeId: 11153, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  preloadNpcTypes: [
    ...Object.entries(npcTypeIds.forms).flatMap(([shielded, weak]) => [form(Number(shielded)), form(weak)]),
    form(npcTypeIds.asleep, seqIds.asleep),
    form(npcTypeIds.blast, seqIds.blastIdle),
    form(npcTypeIds.desperation),
    ...totemTypes,
    ...Object.values(npcTypeIds.husks).map((npcTypeId) => ({ npcTypeId, idleSeqId: husk.idle, walkSeqId: husk.walk, deathSeqId: husk.death, attackClips: { rise: husk.spawn, magic: husk.magic, range: husk.range } })),
    ...[npcTypeIds.parasite, npcTypeIds.parasiteWeak].map((npcTypeId) => ({ npcTypeId, idleSeqId: parasite.idle, deathSeqId: parasite.death, attackClips: { rise: parasite.spawn, cast: parasite.cast, range: parasite.range } })),
    { npcTypeId: npcTypeIds.sleepwalker, idleSeqId: sleepwalker.idle, walkSeqId: sleepwalker.walk, deathSeqId: sleepwalker.death, attackClips: { rise: sleepwalker.spawn, absorb: sleepwalker.absorb } },
  ],
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  createSceneObjectController: dreamObjects,
};

export const phosanisNightmarePresentation = (BaseScene) => ({
  kind: phosanisNightmareKind,
  renderConfig,
  sceneBuilder(context) {
    class DreamScene extends BaseScene {
      // CACHE: the player, the NPCs and her graphics stand on plane 3, 1,240 above plane 0.
      setTerrainHeightsAndBounds(map, bounds) {
        super.setTerrainHeightsAndBounds(map, bounds);
        const heights = map.tileHeights?.[plane];
        if (!heights) return;
        this.terrainHeights = heights;
        this.npcInstanceManager.setTerrainHeights(heights);
        this.spotAnimRenderer.setTerrainHeights(heights);
        // Projectiles (hers, her minions', the player's) fly from and to the surface the scene resolves, which is
        // plane 0's unless told otherwise: 1,240 under the floor, so none was seen. Plane 3's heights instead.
        this.resolveSurfaceHeight = (x, y) => heightAt(heights, x, y);
      }
      // The scene draws an NPC as the type it was first drawn as: when she takes another form, the old one is taken
      // away and drawn again as the new (as the Alchemical Hydra's scene does).
      syncNpcInstances(npcs, ...rest) {
        const { instanceRegistry, dyingInstances } = this.npcInstanceManager;
        for (const npc of npcs ?? []) {
          if (!npc.alive) continue;
          const id = this.getNpcRenderInstanceId(npc.id);
          const drawn = instanceRegistry.get(id) ?? dyingInstances?.get(id)?.instance;
          if (drawn && drawn.npcTypeId !== npc.npcTypeId && this.isNpcTypeLoaded(npc.npcTypeId)) this.npcInstanceManager.removeInstance(id);
        }
        return super.syncNpcInstances(npcs, ...rest);
      }
    }
    return buildScene(DreamScene, renderConfig, context);
  },
  audio: phosanisNightmareAudio,
  // inferred: looking north over her from the player's start, south of her.
  defaultCamera: { yaw: 0, pitch: -50, zoom: 420 },
  presentation: {
    title: "Phosani's Nightmare",
    tagline: "Sisterhood Sanctuary",
    setupContext: "Phosani's dream",
    blurb: "Break her shield and charge the totems three times over, through her claws, husks, flowers, curse, parasites, spores and surges, then outlast her desperation.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Phosani%27s_Nightmare/Strategies",
    portrait: { npcTypeId: 11153, framing: { yaw: -20, pitch: -10, focusHeight: 0.55, span: 0.85 } },
  },
});
// How presentations.js finds it.
export { phosanisNightmarePresentation as presentation };
