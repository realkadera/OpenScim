// What draws the sandbox: one presentation per arena kind, as the Doom's
// deeper room has its own (presentations.js keeps the last per kind), with
// every NPC of the catalog loaded, and the editor (editor.js) brought in step
// with the run every frame.
//
// When the scenario the visit starts with fights the arena's boss with its
// mechanics (encounter.js, the host), the scene is the host's own: Sol
// Heredit's and Yama's scenes are in client/assets/rendering.js, which hands
// every presentation `presentationOf(kind)` to reach them; the render config
// is the host's with the catalog's NPCs added. Which scene a visit gets is
// decided when it is built, from the scenario of the run (visit.js), so
// when the boss is switched on or off the editor has the application enter
// the arena again (editor.js, requestApp("enter")); and should a run start
// whose scenario wants the other scene (a replay or a restart with the boss
// set the other way), the page reloads into it.
import { buildScene } from "../shared/buildScene.js";
import { sandboxArenas, sandboxVariantKind } from "./arenas.js";
import { sandboxPreloadNpcTypes as catalogPreloadNpcTypes, sandboxSpotAnimIds } from "./catalog.js";
import { obstacleNpcTypeIds } from "./obstacles.js";
import { closeSandboxEditor, syncSandboxEditor } from "./editor.js";
import { setActiveScenario } from "./activeScenario.js";
import { getRunningScenario, isHostedVisit } from "./visit.js";
import { onTheBridge } from "../leviathan/presentation.js";
import { plane as dreamPlane } from "../phosanis-nightmare/ids.js";

// In Phosani's dream the actors stand on plane 3, 1,240 above plane 0, as in
// her fight (phosanis-nightmare/presentation.js, DreamScene).
const onTheDream = (BaseScene) =>
  class extends BaseScene {
    setTerrainHeightsAndBounds(map, bounds) {
      super.setTerrainHeightsAndBounds(map, bounds);
      const heights = map.tileHeights?.[dreamPlane];
      if (!heights) return;
      this.terrainHeights = heights;
      this.npcInstanceManager.setTerrainHeights(heights);
      this.spotAnimRenderer.setTerrainHeights(heights);
    }
  };

// The arenas whose scene, without their boss, is not the default one: on the
// Leviathan's Scar the actors stand on the bridge, as in its fight; in
// Phosani's dream on its plane.
const sceneOfArena = { leviathan: onTheBridge, phosanis_nightmare: onTheDream };

// The scene draws an NPC as the type it was first drawn as. A monster of the
// catalog that takes another form (catalog.js: enrage, forms, protects) is
// taken away and drawn again as the new one, as the Alchemical Hydra's scene
// does with its own (alchemical-hydra/presentation.js); in every scene of the
// sandbox, the host's included, but only for the catalog's monsters (an
// archetype "sandbox_<entry>": encounter.js), the host's own NPCs drawn as
// its scene draws them.
function redrawingForms(scene) {
  const sync = scene.syncNpcInstances?.bind(scene);
  if (!sync || !scene.npcInstanceManager) return scene;
  scene.syncNpcInstances = (npcs, ...rest) => {
    const { instanceRegistry, dyingInstances } = scene.npcInstanceManager;
    for (const npc of npcs ?? []) {
      if (!npc.alive || !npc.archetypeId?.startsWith("sandbox_")) continue;
      const id = scene.getNpcRenderInstanceId(npc.id);
      const drawn = instanceRegistry?.get(id) ?? dyingInstances?.get(id)?.instance;
      if (drawn && drawn.npcTypeId !== npc.npcTypeId && scene.isNpcTypeLoaded(npc.npcTypeId)) scene.npcInstanceManager.removeInstance(id);
    }
    return sync(npcs, ...rest);
  };
  return scene;
}

// The catalog's monsters and the obstacles' boulder and jug (obstacles.js),
// which have no sequence (idleSeqId -1, as toa/zebak/phases.js loads them).
const sandboxPreloadNpcTypes = [...catalogPreloadNpcTypes, ...obstacleNpcTypeIds.map((npcTypeId) => ({ npcTypeId, idleSeqId: -1 }))];

const withCatalog = (renderConfig) => ({
  ...renderConfig,
  preloadNpcTypes: [
    ...(renderConfig.preloadNpcTypes ?? []),
    ...sandboxPreloadNpcTypes.filter((entry) => !(renderConfig.preloadNpcTypes ?? []).some((own) => own.npcTypeId === entry.npcTypeId)),
  ],
  spotAnimIds: [...new Set([...(renderConfig.spotAnimIds ?? []), ...sandboxSpotAnimIds])],
});

// Brings the editor in step with a scene of any class, the host's included,
// and the page to the other scene when the run is not the one it was built for.
function withEditor(scene, kind, arena, builtHosted) {
  const build = scene.build.bind(scene);
  const dispose = scene.dispose?.bind(scene);
  let reloading = false;
  scene.build = (input, ...rest) => {
    if (!reloading && isHostedVisit(arena) !== builtHosted) {
      reloading = true;
      const running = getRunningScenario(arena.id);
      if (running) setActiveScenario(running);
      globalThis.location?.reload();
    }
    syncSandboxEditor(kind, input.simulationState);
    return build(input, ...rest);
  };
  // The editor is the page's, not the scene's: it goes when the scene does.
  scene.dispose = (...rest) => {
    closeSandboxEditor();
    return dispose?.(...rest);
  };
  return scene;
}

const presentationOf = (arena) => (BaseScene, packHsl, { presentationOf: presentationOfKind } = {}) => {
  const kind = sandboxVariantKind(arena.id);
  const ownRenderConfig = {
    terrainMapSquare: arena.mapSquare,
    ...(arena.mapSquareOffsets ? { mapSquareOffsets: arena.mapSquareOffsets } : {}),
    locRender: arena.locRender,
    ...(arena.sceneObjects ? { createSceneObjectController: arena.sceneObjects } : {}),
    preloadNpcTypes: sandboxPreloadNpcTypes,
    spotAnimIds: sandboxSpotAnimIds,
  };
  const host = () => (arena.hostKind && presentationOfKind ? presentationOfKind(arena.hostKind) : undefined);
  const hosted = () => isHostedVisit(arena) && host() !== undefined;
  let hostRenderConfig = null;
  const hostedRenderConfig = () => (hostRenderConfig ??= withCatalog(host().renderConfig ?? {}));
  return {
    kind,
    // Read by the application as a visit starts.
    get renderConfig() {
      if (!hosted()) return ownRenderConfig;
      return hostedRenderConfig();
    },
    sceneBuilder(context) {
      if (hosted()) {
        const scene = host().sceneBuilder(context);
        // A host whose scene sets its own render config as it is built
        // (Zebak's, toa/zebak/native.js) gets the sandbox's instead: its own
        // with the catalog's NPCs, so that their attacks play their clips.
        scene.setEncounterRenderConfig?.(hostedRenderConfig());
        return withEditor(redrawingForms(scene), kind, arena, true);
      }
      // What the arena draws besides the map (the open arena's wall): the
      // context's render config is the application's copy, without it (as
      // corrupted-hunllef/presentation.js hands its floor back).
      const config = arena.sceneObjects
        ? { ...(context?.encounterRenderConfig ?? ownRenderConfig), createSceneObjectController: arena.sceneObjects }
        : context?.encounterRenderConfig ?? ownRenderConfig;
      return withEditor(redrawingForms(buildScene(sceneOfArena[arena.id]?.(BaseScene) ?? BaseScene, config, { ...context, encounterRenderConfig: config })), kind, arena, false);
    },
    // The host's camera where the arena has one: it looks at the boss.
    get defaultCamera() {
      return host()?.defaultCamera ?? arena.camera;
    },
    presentation: {
      title: "Sandbox",
      tagline: "Build your own fight",
      setupContext: "Sandbox",
      blurb: "Build a fight of your own: the sandbox editor chooses the arena, places monsters of the other fights and the boss with its own mechanics, and saves, exports and shares scenarios. Each run waits for Start encounter and can be paused.",
    },
  };
};

export const sandboxPresentations = sandboxArenas.map(presentationOf);
