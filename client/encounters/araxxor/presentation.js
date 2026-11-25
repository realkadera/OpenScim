// What draws Araxxor: the default scene, with what it has to load. His model
// and sequences, the eggs', the araxytes', the acid ball's and the effects are
// the game cache's (encounter.js names each). The acid on the floor is the
// object it is in the game, drawn from the fight's snapshot.
import { buildScene } from "../shared/buildScene.js";
import { araxxorAudio } from "./audio.js";
import { araxxorKind, araxxorMapSquare, araxxorMapSquareOffsets, bossStart, ids, seqs, spots } from "./encounter.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// The acid pools (object 54148, shape 10, unturned: OBS).
const acidScene = () => ({
  consumeEvents() {},
  update({ state }) {
    return (state.encounter?.state?.pools ?? []).map(([x, y]) => {
      const id = `araxxor-acid-${x}-${y}`;
      return {
        id, meshId: id, materialId: "osrs-npc", modelMatrix: identity, lifecycle: { kind: "sync" }, classification: "sceneMesh",
        data: { kind: "loc", locId: ids.pool, modelType: 10, rotation: 0, localX: x, localY: y, level: 0, seqId: -1 },
      };
    });
  },
});

const egg = (npcTypeId) => ({ npcTypeId, idleSeqId: seqs.eggIdle, walkSeqId: seqs.eggIdle, deathSeqId: seqs.eggCrumble, attackClips: { spawn: seqs.eggSpawn, crumble: seqs.eggCrumble } });
// The Ruptura does not attack: it walks up and explodes.
const araxyte = (npcTypeId, attack, death) => ({
  npcTypeId, idleSeqId: seqs.araxyteIdle, walkSeqId: seqs.araxyteWalk, deathSeqId: death,
  attackClips: { hatch: seqs.hatch, ...(attack ? { attack } : {}), explode: seqs.explode, death },
});

const renderConfig = {
  terrainMapSquare: araxxorMapSquare,
  mapSquareOffsets: araxxorMapSquareOffsets,
  primaryNpc: { actorId: "araxxor", npcTypeId: ids.boss, basePosition: bossStart, size: 7, deathSeqId: seqs.death },
  preloadNpcTypes: [
    {
      npcTypeId: ids.boss, idleSeqId: seqs.idle, walkSeqId: seqs.walk, deathSeqId: seqs.death, bossDeathAnimationEnabled: true,
      attackClips: {
        attack: seqs.melee, spawn: seqs.spawn, magic: seqs.magic, ranged: seqs.ranged, ball: seqs.ball, spray: seqs.spray, drip: seqs.drip,
        cleave: seqs.cleave, enrage: seqs.enrage, enraged: seqs.enraged,
      },
    },
    egg(ids.eggs.mirrorback),
    egg(ids.eggs.ruptura),
    egg(ids.eggs.acidic),
    araxyte(ids.araxytes.mirrorback, seqs.mirrorbackAttack, seqs.mirrorbackDeath),
    araxyte(ids.araxytes.ruptura, null, seqs.explode),
    araxyte(ids.araxytes.acidic, seqs.acidicAttack, seqs.explode),
    { npcTypeId: ids.ball, idleSeqId: seqs.ballRoll, walkSeqId: seqs.ballRoll, attackClips: { roll: seqs.ballRoll, burst: seqs.ballBurst } },
  ],
  spotAnimIds: [...new Set(Object.values(spots).flatMap((value) => (typeof value === "number" ? [value] : Object.values(value))))],
  createSceneObjectController: acidScene,
};

export const araxxorPresentation = (BaseScene) => ({
  kind: araxxorKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: araxxorAudio,
  // The player comes in at the tunnel, east of him, and looks west (inferred: to be set in the browser).
  defaultCamera: { yaw: 90, pitch: -70, zoom: 330 },
  presentation: {
    title: "Araxxor",
    tagline: "Morytania Spider Cave",
    setupContext: "Araxxor's lair",
    blurb: "Pray against his three styles and keep off the acid of his specials. Deal with the eggs' araxytes as they hatch, and step off the line of his cleave once he is enraged.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Araxxor/Strategies",
    portrait: { npcTypeId: ids.boss, framing: { yaw: -20, pitch: -10, focusHeight: 0.5, span: 0.85 } },
  },
});
// How presentations.js finds it.
export { araxxorPresentation as presentation };
