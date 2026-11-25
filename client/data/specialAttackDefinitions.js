import { getBaseItemId } from "./itemVariants.js";
import { spotAnimIds } from "./spotAnimIds.js";
var elderMaulSpecial = {
  energyCost: 50,
  defenceStyle: "melee_crush",
  animationId: 11124,
  graphicId: 2804,
  postHitEffects: [
    {
      effect: "drain_defence",
      percent: 35,
    },
  ],
};
var accursedSceptreSpecial = {
  energyCost: 50,
  poweredSpellWeaponId: 27665,
  styleOverride: "magic",
  attackKindOverride: "magic_fire",
  animationId: 9961,
  postHitEffects: [
    {
      effect: "condemn",
    },
  ],
};
var abyssalTentacleSpecial = {
  energyCost: 50,
  animationId: 1658,
  targetGraphic: {
    spotAnimId: 341,
    delayCycles: 0,
    height: 96,
  },
  onFireEffects: [
    {
      effect: "freeze",
      durationTicks: 8,
    },
    {
      effect: "poison",
      severity: 4,
      chancePercent: 50,
    },
  ],
};
var zaryteCrossbowSpecial = {
  energyCost: 75,
  animationId: 9166,
};
var specialAttackDefinitionByWeaponId = {
  29589: {
    energyCost: 50,
    defenceStyle: "melee_stab",
    animationId: 11138,
    graphicId: 2810,
    postHitEffects: [
      {
        effect: "weaken",
      },
    ],
  },
  27665: accursedSceptreSpecial,
  27679: accursedSceptreSpecial,
  27676: accursedSceptreSpecial,
  27291: { energyCost: 75, instantEffect: "tumekensLight" },
  11791: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  12904: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  22296: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  24144: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  12006: abyssalTentacleSpecial,
  26484: abyssalTentacleSpecial,
  13652: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    isMultiHit: true,
    animationId: 7514,
    graphicId: 1171,
  },
  20784: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    isMultiHit: true,
    animationId: 7514,
    graphicId: 1171,
  },
  11806: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7640,
    graphicId: 1209,
    postHitEffects: [
      {
        effect: "heal_hp",
        percentOfDamage: 50,
      },
      {
        effect: "restore_prayer",
        percentOfDamage: 25,
      },
    ],
  },
  20372: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7640,
    graphicId: 1209,
    postHitEffects: [
      {
        effect: "heal_hp",
        percentOfDamage: 50,
      },
      {
        effect: "restore_prayer",
        percentOfDamage: 25,
      },
    ],
  },
  11804: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7642,
    postHitEffects: [
      {
        effect: "drain_defence",
        flat: true,
      },
    ],
  },
  20370: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7642,
    postHitEffects: [
      {
        effect: "drain_defence",
        flat: true,
      },
    ],
  },
  11802: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7644,
    graphicId: 1211,
  },
  20368: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7644,
    graphicId: 1211,
  },
  11808: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7638,
    graphicId: 1210,
    postHitEffects: [
      {
        effect: "freeze",
        durationTicks: 32,
      },
    ],
  },
  20374: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7638,
    graphicId: 1210,
    postHitEffects: [
      {
        effect: "freeze",
        durationTicks: 32,
      },
    ],
  },
  13576: {
    defenceStyle: "melee_crush",
    energyCost: 50,
    animationId: 1378,
    graphicId: 1292,
    postHitEffects: [
      {
        effect: "drain_defence",
        percent: 30,
      },
    ],
  },
  31113: {
    energyCost: 50,
    animationId: 12394,
    graphicId: 3364,
    attackSpeedOverride: 5,
    postHitEffects: [
      {
        effect: "drain_magic",
        base: 0,
        percentOfDamage: 100,
      },
    ],
  },
  29594: {
    energyCost: 25,
    styleOverride: "magic",
    onKillEffect: {
      refundSpecEnergy: 25,
      reduceAttackDelayTicks: 3,
      targetGraphicBySize: [
        spotAnimIds.VFX_IGNITE_STAFF_01_1X1,
        spotAnimIds.VFX_IGNITE_STAFF_01_2X2,
        spotAnimIds.VFX_IGNITE_STAFF_01_3X3,
      ],
    },
  },
  27690: {
    energyCost: 50,
    styleOverride: "magic",
    attackKindOverride: "magic_fire",
    guaranteedHit: true,
    animationId: 11275,
    graphicId: 2834,
    targetGraphic: {
      spotAnimId: 2363,
      delayCycles: 0,
      height: 0,
    },
  },
  29591: {
    energyCost: 25,
    targetAttribute: "demon",
    animationId: 11133,
    graphicId: 2806,
    targetGraphic: {
      spotAnimId: 2808,
      delayCycles: "projectile_arrival",
      height: 0,
    },
    hitDelayTicks: 3,
    onFireEffects: [
      {
        effect: "bind",
        delayTicks: 2,
        durationTicks: 21,
      },
      {
        effect: "burn",
        firstPulseDelayTicks: 3,
        pulses: 6,
        severity: "normal",
      },
    ],
  },
  29577: {
    energyCost: 35,
    isMultiHit: true,
    animationId: 11140,
    graphicId: 2814,
    postHitEffects: [
      {
        effect: "burn",
        pulses: 10,
        severity: "normal",
        chancePercentByBranch: [15, 30, 45],
      },
    ],
  },
  11785: {
    energyCost: 50,
    animationId: 7552,
  },
  // Zaryte crossbow, Evoke: 75% (WIKI); animation 9166 (OBS, rsprox, as tsps
  // server/plugins/combat/specials/ZaryteCrossbow.SpecialAttack.js).
  26374: zaryteCrossbowSpecial,
  27186: zaryteCrossbowSpecial,
  12926: {
    energyCost: 50,
    animationId: 5061,
    launchHeal: {
      percentOfDamage: 50,
      minimumHeal: 0,
    },
  },
  1215: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  1231: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  5680: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  5698: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  13265: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13267: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13269: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13271: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  1305: {
    defenceStyle: "melee_slash",
    animationId: 1058,
  },
  21009: {
    defenceStyle: "melee_stab",
    animationId: 7515,
  },
  4587: {
    energyCost: 55,
    defenceStyle: "melee_slash",
    animationId: 1872,
  },
  // Arkan blade, "Flames of Ralos" (oldschool.runescape.wiki/w/Arkan_blade,
  // read 2026-11-23): 30 % of the energy; one hit, rolled against slash
  // defence, with accuracy and damage raised by half (playerAttack/profiles.js);
  // a hit burns the target for 10 damage over 40 ticks, a strong burn. The
  // wiki has no ids: the animation and the effect on the player are the
  // cache's vmq4_arkan_blade_special and vmq4_arkan_blade_special_spotanim.
  30955: {
    energyCost: 30,
    defenceStyle: "melee_slash",
    animationId: 12297,
    graphicId: 3336,
    postHitEffects: [
      {
        effect: "burn",
        pulses: 10,
        severity: "strong",
      },
    ],
  },
  // Eldritch nightmare staff, "Invocate"
  // (oldschool.runescape.wiki/w/Eldritch_Nightmare_staff, read 2026-11-23): 55 %
  // of the energy; a magic hit that needs no runes, with a base max hit by
  // the Magic level (engine/weapons.js), cast from 10 tiles; it restores
  // prayer points by half the damage rolled, beyond the player's level too,
  // up to 120. A recording of the game (2026-11-23, four casts) has the rest: the hitsplat and the prayer come
  // 3 ticks after the animation; the animation and the two effects, one on
  // the player and one on the target, start on the tick of the cast; a hit
  // that the target's 48 hitpoints cut short restored 28.
  24425: {
    energyCost: 55,
    poweredSpellWeaponId: 24425,
    styleOverride: "magic",
    attackKindOverride: "magic_fire",
    attackRange: 10,
    hitDelayTicks: 3,
    animationId: 8532,
    graphicId: 1762,
    targetGraphic: {
      spotAnimId: 1761,
      delayCycles: 0,
      height: 0,
    },
    postHitEffects: [
      {
        effect: "restore_prayer",
        percentOfDamage: 50,
        ofRolledDamage: true,
        minimumRestore: 0,
        maximumPoints: 120,
      },
    ],
  },
  1434: {
    defenceStyle: "melee_crush",
    animationId: 1060,
  },
  11061: {
    defenceStyle: "melee_crush",
    animationId: 6147,
  },
  4153: {
    animationId: 1667,
  },
  12848: {
    animationId: 1667,
  },
  1377: {
    animationId: 1056,
  },
  3204: {
    defenceStyle: "melee_slash",
    animationId: 1203,
  },
  23987: {
    defenceStyle: "melee_slash",
    animationId: 1203,
  },
  23986: {
    defenceStyle: "melee_slash",
    animationId: 1203,
  },
  1249: {
    energyCost: 25,
    animationId: 1064,
  },
  1263: {
    energyCost: 25,
    animationId: 1064,
  },
  5716: {
    energyCost: 25,
    animationId: 1064,
  },
  5730: {
    energyCost: 25,
    animationId: 1064,
  },
  11824: {
    energyCost: 25,
    animationId: 1064,
  },
  11889: {
    energyCost: 25,
    animationId: 1064,
  },
  4151: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  12773: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  12774: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  26482: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  11838: {
    animationId: 1132,
  },
  12809: {
    animationId: 1132,
  },
  13263: {
    animationId: 3299,
    targetGraphic: {
      spotAnimId: 1284,
      delayCycles: 15,
      height: 0,
    },
  },
  21003: elderMaulSpecial,
  27100: elderMaulSpecial,
  21015: {
    defenceStyle: "melee_crush",
    animationId: 7511,
  },
  11235: {
    animationId: 426,
  },
  12765: {
    animationId: 426,
  },
  12766: {
    animationId: 426,
  },
  12767: {
    animationId: 426,
  },
  12768: {
    animationId: 426,
  },
  861: {
    animationId: 426,
  },
  // Seercull, Soulshot. WIKI: "consumes 100% of the player's special attack
  // energy", "is guaranteed to hit" and "lowers the opponent's Magic level
  // equal to damage dealt", and "will only drain the opponent's Magic level
  // if it is not already reduced". The hit and its damage are the profile's
  // (playerAttack/profiles.js). Animation: the bows' own shot, as the other
  // bows here; its graphics are the renderer's (rendering.js, PD).
  6724: {
    energyCost: 100,
    animationId: 426,
    postHitEffects: [
      {
        effect: "drain_magic",
        base: 0,
        percentOfDamage: 100,
        onlyIfUndrained: true,
      },
    ],
  },
  12788: {
    animationId: 426,
  },
  19478: {
    animationId: 7555,
  },
  19481: {
    animationId: 7555,
  },
  21902: {
    animationId: 4230,
  },
  26219: {
    defenceStyle: "melee_stab",
    energyCost: 25,
    animationId: 11222,
    graphicId: 2833,
  },
  27246: {
    defenceStyle: "melee_stab",
    energyCost: 25,
    animationId: 11222,
    graphicId: 2833,
  },
  28338: {
    energyCost: 0,
    animationId: 10173,
    graphicId: 2430,
  },
  23995: {
    animationId: 390,
  },
  24551: {
    animationId: 390,
  },
  25870: {
    animationId: 390,
  },
  25872: {
    animationId: 390,
  },
  25874: {
    animationId: 390,
  },
  25876: {
    animationId: 390,
  },
  25878: {
    animationId: 390,
  },
  25880: {
    animationId: 390,
  },
  25882: {
    animationId: 390,
  },
  22613: {
    defenceStyle: "melee_stab",
    animationId: 7515,
  },
  22622: {
    defenceStyle: "melee_stab",
    animationId: 7515,
  },
  22616: {
    defenceStyle: "melee_crush",
    animationId: 1378,
  },
  22625: {
    defenceStyle: "melee_crush",
    animationId: 1378,
  },
  22610: {
    animationId: 8184,
  },
  22619: {
    animationId: 8184,
  },
  22634: {
    animationId: 929,
  },
  22636: {
    animationId: 929,
  },
  22631: {
    animationId: 929,
  },
  22633: {
    animationId: 929,
  },
  11920: {
    animationId: 400,
  },
  12797: {
    animationId: 400,
  },
  23677: {
    animationId: 400,
  },
  25376: {
    animationId: 400,
  },
  4755: {
    animationId: 2062,
  },
  4982: {
    animationId: 2062,
  },
};
function getSpecialAttackDefinition(weaponId) {
  const definition = specialAttackDefinitionByWeaponId[getBaseItemId(weaponId)];
  if (definition !== undefined && weaponId === 28688) {
    return {
      ...definition,
      animationId: 10656,
    };
  } else {
    return definition;
  }
}
function hasSpecialAttack(weaponId) {
  return getSpecialAttackDefinition(weaponId) !== undefined;
}
export { getSpecialAttackDefinition, hasSpecialAttack };
