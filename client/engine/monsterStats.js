import { monsterByNpcTypeId, monsterByNpcTypeIdAndVersion } from "../data/monsters.js";
function getMonsterHitpoints(npcTypeId) {
  return monsterByNpcTypeId.get(npcTypeId)?.levels.hitpoints;
}
function getMonsterFormulaStats(npcTypeId, version) {
  const monster = version === undefined ? monsterByNpcTypeId.get(npcTypeId) : monsterByNpcTypeIdAndVersion.get(`${npcTypeId}:${version}`);
  if (monster) {
    return {
      burnImmunity: monster.immunities.burn,
      freezeResistance: monster.immunities.freeze,
      poisonResistance: monster.immunities.poison,
      attributes: monster.attributes,
      // { element, percent } (#44), only on a monster that has one: the rest keep the stats they had.
      ...(monster.elementalWeakness ? { elementalWeakness: monster.elementalWeakness } : {}),
      levels: {
        attack: monster.levels.attack,
        strength: monster.levels.strength,
        defence: monster.levels.defence,
        ranged: monster.levels.ranged,
        magic: monster.levels.magic,
      },
      offensive: {
        atk: monster.offensive.attack,
        ranged: monster.offensive.ranged,
        magic: monster.offensive.magic,
        str: monster.offensive.strength,
        rangedStr: monster.offensive.rangedStrength,
        magicStr: monster.offensive.magicDamage,
      },
      defensive: {
        stab: monster.defensive.stab,
        slash: monster.defensive.slash,
        crush: monster.defensive.crush,
        rangedLight: monster.defensive.rangedLight,
        rangedStandard: monster.defensive.rangedStandard,
        rangedHeavy: monster.defensive.rangedHeavy,
        magic: monster.defensive.magic,
      },
    };
  }
}
function applyMonsterStatOverride(formulaStats, override) {
  if (!formulaStats || !override) {
    return formulaStats;
  }
  const { skills: skills, defensive: defensive } = override;
  return {
    ...formulaStats,
    levels: {
      attack: skills?.atk ?? formulaStats.levels.attack,
      strength: skills?.str ?? formulaStats.levels.strength,
      defence: skills?.def ?? formulaStats.levels.defence,
      ranged: skills?.ranged ?? formulaStats.levels.ranged,
      magic: skills?.magic ?? formulaStats.levels.magic,
    },
    defensive: {
      stab: defensive?.stab ?? formulaStats.defensive.stab,
      slash: defensive?.slash ?? formulaStats.defensive.slash,
      crush: defensive?.crush ?? formulaStats.defensive.crush,
      rangedLight: defensive?.light ?? formulaStats.defensive.rangedLight,
      rangedStandard: defensive?.standard ?? formulaStats.defensive.rangedStandard,
      rangedHeavy: defensive?.heavy ?? formulaStats.defensive.rangedHeavy,
      magic: defensive?.magic ?? formulaStats.defensive.magic,
    },
  };
}
export { getMonsterHitpoints, getMonsterFormulaStats, applyMonsterStatOverride };
