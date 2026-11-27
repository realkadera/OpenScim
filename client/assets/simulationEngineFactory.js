// This chunk was split into the modules below. It re-exports them for the
// files that still import from here.
export {
  isItemStackable,
  createEmptyCombatSupplies,
  areCombatSuppliesEqual,
  parseCombatSupplies,
  createEmptyInventory,
  cloneCombatSupplies,
  withRunePouchSlot,
  normalizeInventory,
} from "../engine/supplies.js";
export {
  retiredEncounterKindEntries,
  consolidateRetiredEncounterKinds,
  encounterDefinitions,
  resolveBaseEncounterKind,
  isEncounterKind,
  resolveRetiredEncounterKind,
} from "../engine/encounterKinds.js";
export {
  hasRuneAvailable,
  COMBINATION_RUNE_ITEM_IDS,
  DEATH_CHARGE_SPELL,
  getSpellRuneTypes,
  hasMagicLevelForSpell,
  getRequiredMagicLevel,
  RUNE_ITEM_IDS,
  MARK_OF_DARKNESS_SPELL,
  canCastSpell,
} from "../engine/spells.js";
export { consumableDefinitionByItemId } from "../engine/consumables.js";
export { getSoulreaperStacksForWeapon } from "../engine/specialAttacks.js";
export { applyPrayerActions } from "../engine/prayers.js";
import "../engine/attackResources.js";
import "../engine/CombatSystem.js";
import "../engine/playerAttack/projection.js";
import "../engine/playerAttack/roll.js";
import "../engine/playerAttack/plan.js";
import "../engine/playerAttack/formula.js";
import "../engine/playerAttack/profiles.js";
import "../engine/playerAttack/planPlayerAttack.js";
import "../engine/playerAttack/launch.js";
export { parseEngineBootstrap } from "../engine/bootstrap.js";
import "../engine/TickEventBuffer.js";
import "../engine/prayerProjection.js";
import "../engine/playerMovement.js";
import "../engine/WorldState.js";
export { SimulationEngine } from "../engine/SimulationEngine.js";
export { rebuildEngineAtReplayFrame } from "../engine/replay.js";
export { createSimulationEngine } from "../engine/createSimulationEngine.js";
