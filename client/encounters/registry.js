import { zebakDefinition } from "/toa/zebak/native.js";
import { nexusDefinition } from "/toa/nexus.js";
import { doomDefinition } from "./doom-of-mokhaiotl/encounter.js";
import { definition as yamaDefinition } from "./yama/encounter.js";
import { definition as lobbyDefinition } from "./lobby/encounter.js";
import { definition as solHereditDefinition } from "./sol-heredit/encounter.js";
import { definition as infernoDefinition } from "./inferno/encounter.js";
import { getArenaWalkableTiles } from "../engine/arena.js";
import { CollisionFlag, createCollisionMap } from "../engine/collision.js";
import { createSeededRandom } from "../engine/random.js";
import { startScriptedNpcDeath } from "../engine/npcState.js";
import { rollNpcAttack } from "./shared/npcAttack.js";
import { buildNpcProjectileVisual } from "./shared/npcHelpers.js";
import { emitInfernoVisual, emitInfernoNpcAttack } from "./inferno/events.js";
import { getMonsterFormulaStats } from "../engine/monsterStats.js";
import { colosseumDefinition } from "./colosseum/ColosseumEncounter.js";
import { vardorvisDefinition } from "./vardorvis/encounter.js";
import { buildSandboxDefinition } from "./sandbox/encounter.js";
// The encounters the client can run, and the registry the engine asks for
// the encounter of a kind (engine/createSimulationEngine.js calls
// encounterRegistry.create). This module imports no chunk.
//
// One definition per encounter. Its keys:
//   kind               the name the encounter goes by ("yama_p3", "inferno")
//   slug               optional: the address of its route, when that is not
//                      the kind with "-" for "_" ("yama" for "yama_p3");
//                      `null` for an encounter without a route (the lobby)
//   factory(options)   makes the encounter object; `options` is what
//                      encounterRegistry.create was given
//   descriptor         what is known of the encounter before a fight exists:
//                      display name, map square, the player's start tile,
//                      how the arena's collision is built, variants or
//                      modifiers, the victory text
//   controls           what its menus offer: defaultMechanicsConfig,
//                      mechanicsToggles, debugActions; some have more
//   enableIntro        optional; isIntroEnabledForKind answers from it
//   variantFactories,  optional: further kinds, each with a factory and
//   variantControls    controls of its own. They are registered without a
//                      descriptor (Yama's contracts)
//   variantDescriptors optional: a variant kind's own descriptor, found by
//                      getDescriptorOfKindOrVariant only (the Doom's deeper
//                      room on another map square); its kind stays the base's
//   retiredEntries     optional: names that are kinds no more, each with the
//                      mechanics it stands for (resolveKindOrRetiredEntry)
//   countdownMovement  optional; hasCountdownMovement answers from it
// A definition is written beside its encounter and imported here. The first
// two come from client/toa/; Zebak's is built from the rules handed to it
// here.
//
// engine/encounterKinds.js reads its table of kinds (variant kinds, route
// slugs, retired kinds) off this list: a kind is written here and nowhere
// else. The presentations (what draws an encounter) are a second list:
// presentations.js beside this module has those that are written in
// modules, the chunk rendering.js its own four.
//
// The engine reads no descriptor. The application does, in the hook that
// prepares an encounter (assets/application.js; prepareArena in
// tools/determinism/harness.mjs does the same): unless `collision.mode` is
// "custom", it has the cache loader build the arena of the kind from
// `mapSquare` and `mapSquareOffsets`, handing it the tile `collision.seed`
// (or `playerStart` when there is none), `collision.dynamicLocs` as extra
// locs and `collision.excludedStaticLocIds`; it registers that arena for
// the kind (registerArenaConfig of engine/arena.js) and tells the engine to
// take it (reapplyArenaConfig). Until an arena is registered for the kind,
// and always with "custom", the engine runs on the encounter's own
// getArenaConfig().
var registeredEncounterDefinitions = [
  zebakDefinition({makeCollision:createCollisionMap,solidFlag:CollisionFlag.OBJECT,walkable:getArenaWalkableTiles,stats:getMonsterFormulaStats, seedRandom:createSeededRandom, rollAttack:rollNpcAttack, showAttack:emitInfernoNpcAttack, projectile:buildNpcProjectileVisual, animate:emitInfernoVisual, startNpcDeath:startScriptedNpcDeath}),
  nexusDefinition,
  doomDefinition,
  yamaDefinition,
  lobbyDefinition,
  solHereditDefinition,
  colosseumDefinition,
  vardorvisDefinition,
  infernoDefinition,
];
// The sandbox runs the other encounters as the hosts of its arenas: it is
// handed their definitions.
registeredEncounterDefinitions.push(buildSandboxDefinition([...registeredEncounterDefinitions]));
function getDefinitionKinds(definition) {
  return [definition.kind, ...Object.keys(definition.variantFactories ?? {})];
}
var definitionByKind = new Map(registeredEncounterDefinitions.flatMap((definition) => getDefinitionKinds(definition).map((kind) => [kind, definition])));
function getDefinitionOfKind(kind) {
  return definitionByKind.get(kind);
}
var infiniteHealthToggle = {
  key: "infiniteHealth",
  label: "Infinite Health",
  group: "aid",
};
var infiniteSpecialAttackToggle = {
  key: "infiniteSpecialAttack",
  label: "Infinite Special Attack",
  group: "aid",
};
var controlsByKind = new Map(
  registeredEncounterDefinitions.flatMap((definition) =>
    getDefinitionKinds(definition).map((kind) => {
      const controls = definition.variantControls?.[kind] ?? definition.controls;
      return [
        kind,
        {
          ...controls,
          mechanicsToggles: [...controls.mechanicsToggles, infiniteHealthToggle, infiniteSpecialAttackToggle],
        },
      ];
    }),
  ),
);
function getEncounterControls(kind) {
  return controlsByKind.get(kind);
}
function isIntroEnabledForKind(kind) {
  return getDefinitionOfKind(kind)?.enableIntro === true;
}
function hasCountdownMovement(kind, mechanics) {
  return getDefinitionOfKind(kind)?.countdownMovement?.(mechanics) === true;
}
function resolveKindOrRetiredEntry(kind) {
  if (getDefinitionOfKind(kind)) {
    return {
      kind: kind,
      mechanics: {},
    };
  }
  for (const definition of registeredEncounterDefinitions) {
    const retiredMechanics = definition.retiredEntries?.[kind];
    if (retiredMechanics) {
      return {
        kind: definition.kind,
        mechanics: retiredMechanics,
      };
    }
  }
}
var DuplicateEncounterKindError = class extends Error {
  kind;
  constructor(kind) {
    super(`Duplicate encounter kind: '${kind}'`);
    this.kind = kind;
    this.name = "DuplicateEncounterKindError";
  }
};
var EncounterDescriptorKindMismatchError = class extends Error {
  kind;
  descriptorKind;
  constructor(kind, descriptorKind) {
    super(`Encounter '${kind}' has a mismatched descriptor kind '${descriptorKind}'`);
    this.kind = kind;
    this.descriptorKind = descriptorKind;
    this.name = "EncounterDescriptorKindMismatchError";
  }
};
// `factories` has every kind, the variant kinds among them; `descriptors`
// only the kinds registered with one. getDescriptor answers for those;
// getDescriptorOfKindOrVariant also finds, for a variant kind, the descriptor
// that lists it among its `variants`.
var variantDescriptors = new Map();
var encounterRegistry = new (class {
  factories = new Map();
  descriptors = new Map();
  register(kind, factory, descriptor) {
    if (this.factories.has(kind)) {
      throw new DuplicateEncounterKindError(kind);
    }
    if (descriptor && descriptor.kind !== kind) {
      throw new EncounterDescriptorKindMismatchError(kind, descriptor.kind);
    }
    this.factories.set(kind, factory);
    if (descriptor) {
      this.descriptors.set(kind, descriptor);
    }
  }
  create(kind, options) {
    const factory = this.factories.get(kind);
    if (!factory) {
      const registeredKinds = this.getRegisteredKinds();
      const registeredKindsText = registeredKinds.length > 0 ? registeredKinds.join(", ") : "(none)";
      throw new Error(`Unknown encounter kind: '${kind}'. Registered kinds: ${registeredKindsText}`);
    }
    return factory(options);
  }
  getRegisteredKinds() {
    return Array.from(this.factories.keys());
  }
  isRegistered(kind) {
    return this.factories.has(kind);
  }
  getDescriptor(kind) {
    return this.descriptors.get(kind);
  }
  getDescriptorOfKindOrVariant(kind) {
    const descriptor = this.descriptors.get(kind);
    if (descriptor) {
      return descriptor;
    }
    if (variantDescriptors.has(kind)) return variantDescriptors.get(kind);
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.variants?.some((variant) => variant.encounterKind === kind)) {
        return descriptor;
      }
    }
  }
})();
for (const definition of registeredEncounterDefinitions) {
  encounterRegistry.register(definition.kind, definition.factory, definition.descriptor);
  for (const [variantKind, variantFactory] of Object.entries(definition.variantFactories ?? {})) {
    encounterRegistry.register(variantKind, variantFactory);
  }
}
for (const definition of registeredEncounterDefinitions) {
  for (const [variantKind, descriptor] of Object.entries(definition.variantDescriptors ?? {})) variantDescriptors.set(variantKind, descriptor);
}
export { registeredEncounterDefinitions, getDefinitionKinds, controlsByKind, getEncounterControls, isIntroEnabledForKind, hasCountdownMovement, resolveKindOrRetiredEntry, encounterRegistry };
