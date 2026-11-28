// What draws the Whisperer: the default scene, with what it has to load (data.js names each id). The scene draws her
// in the form the fight says (the Odd Figure until she has risen, her binding form), draws again an NPC whose type
// the fight changes (the columns and souls of the Shadow Realm), places the seeds of her Corrupted Seeds as the cache's objects, and keeps
// the sanity bar and the Shadow Realm's darkness (sanity.js) in step with the fight.
import { buildScene } from "../shared/buildScene.js";
import { bossActorId, bossSite, bossSize, ids, mapSquare, seqs, spots, whispererKind } from "./encounter.js";
import { seedLocs } from "./data.js";
import { syncSanity } from "./sanity.js";

const bossClips = {
  spawn: seqs.spawn, melee: seqs.melee, ranged: seqs.ranged, rangedAlt: seqs.rangedAlt, magic: seqs.magic, magicAlt: seqs.magicAlt,
  teleport: seqs.teleport, appear: seqs.appear, screech: seqs.screech, screechHold: seqs.screechHold, screechBlast: seqs.screechBlast,
  bind: seqs.bind, souls: seqs.souls, soulChant: seqs.soulChant, soulResolve: seqs.soulResolve,
};
const boss = (npcTypeId) => ({ npcTypeId, idleSeqId: seqs.idle, walkSeqId: seqs.walk, deathSeqId: seqs.death, bossDeathAnimationEnabled: true, attackClips: bossClips });
const column = (npcTypeId) => ({ npcTypeId, idleSeqId: seqs.columnIdle, walkSeqId: seqs.columnIdle, attackClips: { rise: seqs.columnSpawn } });
const soul = (npcTypeId) => ({ npcTypeId, idleSeqId: seqs.soulIdle, walkSeqId: seqs.soulIdle, deathSeqId: seqs.soulFade, attackClips: { spawn: seqs.soulSpawn, fade: seqs.soulFade, chant: seqs.soulChantSay } });

const renderConfig = {
  terrainMapSquare: mapSquare,
  // The cathedral's walls stand on levels 0 and 1 (CACHE).
  locRender: { bounds: null, levels: [0, 1] },
  primaryNpc: { actorId: bossActorId, npcTypeId: ids.boss, basePosition: bossSite, size: bossSize, deathSeqId: seqs.death },
  preloadNpcTypes: [
    { npcTypeId: ids.figure, idleSeqId: seqs.figureIdle, walkSeqId: seqs.figureIdle, attackClips: { spawn: seqs.spawn } },
    boss(ids.boss),
    boss(ids.melee),
    { npcTypeId: ids.tentacle, idleSeqId: seqs.tentacleIdle, walkSeqId: seqs.tentacleIdle, deathSeqId: seqs.tentacleDeath,
      attackClips: { spawn: seqs.tentacleSpawn, attack: seqs.tentacleAttack } },
    column(ids.column),
    column(ids.columnShadow),
    soul(ids.soul),
    soul(ids.soulShadow),
  ],
  spotAnimIds: [...new Set(Object.values(spots).flat())],
  // The seeds: in the Shadow Realm a light and a dark one, outside one look for both (data.js).
  createSceneObjectController: () => ({
    consumeEvents() {},
    update({ state }) {
      const fight = state.encounter?.state;
      const seeds = fight?.special?.kind === "seeds" ? fight.special.seeds : [];
      return seeds.map(({ at: [x, y], light }) => {
        const locId = fight.shadow ? (light ? seedLocs.light : seedLocs.dark) : seedLocs.real;
        const id = `whisperer-seed-${x}-${y}-${locId}`;
        return {
          // Shape 10: the seeds' locs name their models without shapes, which the cache draws only as that one.
          id, meshId: id, materialId: "osrs-npc", modelMatrix: identity, lifecycle: { kind: "sync" }, classification: "sceneMesh",
          data: { kind: "loc", locId, modelType: 10, rotation: 0, localX: x, localY: y, level: 0, seqId: -1 },
        };
      });
    },
  }),
};
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export const whispererPresentation = (BaseScene) => ({
  kind: whispererKind,
  renderConfig,
  sceneBuilder(context) {
    class WhispererScene extends BaseScene {
      build(input, ...rest) {
        const queue = super.build(input, ...rest);
        const fight = input.simulationState?.encounter?.state;
        syncSanity(fight && fight.phase !== "asleep" && fight.phase !== "dead" ? { sanity: fight.sanity, shadow: fight.shadow } : null);
        return queue;
      }
      // The overlay is the page's, not the scene's: it goes when the scene does.
      dispose(...rest) {
        syncSanity(null);
        return super.dispose?.(...rest);
      }
      syncNpcInstances(npcs, hidden, state, ...rest) {
        // Her actor is 12204 throughout; she is drawn as the form the fight says (encounter.js).
        const form = state?.encounter?.state?.form;
        const formType = form === "figure" ? ids.figure : form === "binding" ? ids.melee : ids.boss;
        const drawnNpcs = npcs.map((npc) => (npc.id === bossActorId && formType !== npc.npcTypeId && this.isNpcTypeLoaded(formType) ? { ...npc, npcTypeId: formType } : npc));
        // A drawn NPC keeps the type it was made with: when that changes, it is made again (as Duke Sucellus's).
        for (const npc of drawnNpcs) {
          const id = this.getNpcRenderInstanceId(npc.id);
          const drawn = this.npcInstanceManager.instanceRegistry.get(id);
          if (drawn && drawn.npcTypeId !== npc.npcTypeId && this.isNpcTypeLoaded(npc.npcTypeId)) this.npcInstanceManager.removeInstance(id);
        }
        return super.syncNpcInstances(drawnNpcs, hidden, state, ...rest);
      }
    }
    return buildScene(WhispererScene, renderConfig, context);
  },
  // She is south of the player as they arrive: from the north, looking south.
  defaultCamera: { yaw: 180, pitch: -45, zoom: 300 },
  presentation: {
    title: "The Whisperer",
    tagline: "Desert Treasure II",
    setupContext: "The Lassar Undercity",
    blurb: "Pray against her volleys and step off her tentacles' lines. Take the Blackstone fragment into the Shadow Realm for her seeds, her screech and her souls, and mind your sanity.",
    wikiUrl: "https://oldschool.runescape.wiki/w/The_Whisperer/Strategies",
    portrait: { npcTypeId: ids.boss, framing: { yaw: -20, pitch: -10, focusHeight: 0.55, span: 0.8 } },
  },
});
// How presentations.js finds it.
export { whispererPresentation as presentation };
