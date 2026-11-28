// Brutus's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Brutus/Strategies): the first of each slot of its "Melee (high level)", "Melee (free-to-play)" and "Ranged
// (free-to-play)" tables. Its magic table's weapon, a staff of earth with earth spells, needs the standard spellbook,
// which the client doesn't offer yet. Two changes from the guide: trout and t-bone steaks aren't edible in the client,
// so the food is anglerfish, as in the other bosses' setups; and its "Decorative boots (gold)" is one of several
// decorative boots in the equipment list with no name to tell them apart, so leather boots, its ranged table's, stand
// in.
const anglerfish = 13441;
const divineSuperCombat = 23685; // Divine super combat potion(4)
const prayerPotion = 2434; // Prayer potion(4)
const food = (count) => Array.from({ length: count }, () => anglerfish);
const noSupplies = { equippedAmmo: null, quiverAmmo: null, runePouch: null, blowpipe: null, selectedSpell: null, spellbook: "standard" };

export const brutusLoadouts = {
  max: {
    name: "Melee (Scythe of Vitur)",
    equipment: {
      head: 26382, // Torva full helm
      cape: 21295, // Infernal cape
      amulet: 29801, // Amulet of rancour
      weapon: 22325, // Scythe of Vitur (two-handed: the guide's Avernic defender can't go with it)
      body: 26384, // Torva platebody
      legs: 26386, // Torva platelegs
      hands: 22981, // Ferocious gloves
      boots: 31097, // Avernic treads (max)
      ring: 28307, // Ultor ring
    },
    // The guide's: divine super combat potions, prayer potions and food; a crystal halberd for its special.
    inventory: [23987, divineSuperCombat, prayerPotion, prayerPotion, ...food(24)],
    supplies: { ...noSupplies, equippedAmmo: { id: 22947 } }, // Rada's blessing 4
  },
  f2p_melee: {
    name: "Melee (free-to-play)",
    equipment: {
      head: 1163, // Rune full helm
      cape: 1007, // Red cape
      amulet: 1725, // Amulet of strength
      weapon: 1333, // Rune scimitar
      body: 1113, // Rune chainbody
      shield: 33101, // Mooleta
      legs: 1093, // Rune plateskirt
      hands: 23261, // Gilded d'hide vambraces
      boots: 1061, // Leather boots (see above)
    },
    inventory: food(28),
    supplies: noSupplies,
  },
  f2p_ranged: {
    name: "Ranged (free-to-play)",
    equipment: {
      head: 1169, // Coif
      cape: 1007, // Red cape
      amulet: 1731, // Amulet of power
      weapon: 853, // Maple shortbow
      body: 1135, // Green d'hide body
      legs: 1099, // Green d'hide chaps
      hands: 1065, // Green d'hide vambraces
      boots: 1061, // Leather boots
    },
    inventory: food(28),
    supplies: { ...noSupplies, equippedAmmo: { id: 890 } }, // Adamant arrows
  },
};
