// Phosani's Nightmare's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's
// strategy guide (Phosani's Nightmare/Strategies, "Equipment"): the best of each slot of its Melee table that the
// client has, with a magic weapon to charge the totems ("magic accuracy is useless against totems because they have
// no stats", and melee upgrades come first).
// - Inquisitor's: its set and mace, the guide's crush weapon (crush always hits husks and weakened parasites for its
//   most). Its first weapon, the Obligator, and its husk weapon, the Hallowfell, are not in the client's cache.
// - Scythe: the Scythe of Vitur, the guide's next weapon, in the same armour.
// Both carry Tumeken's shadow for the totems, the Voidwaker for her desperation (the guide's next special after the
// Crimson kisten, which the client has no special attack for), sanfew serums for her parasites (WIKI: a dose weakens
// one), prayer potions, a divine super combat potion and anglerfish (the guide's inventory is not in its text).
// Tumeken's shadow, Voidwaker, Divine super combat potion(4), any other weapon; Sanfew serum(4) x 4; Prayer
// potion(4) x 8; Anglerfish to fill the 28.
const inventory = (...others) => {
  const items = [27275, 27690, 23685, ...others, 10925, 10925, 10925, 10925, ...Array(8).fill(2434)];
  return [...items, ...Array(28 - items.length).fill(13441)];
};
const armour = {
  head: 24419, // Inquisitor's great helm
  cape: 21295, // Infernal cape
  amulet: 29801, // Amulet of rancour
  body: 24420, // Inquisitor's hauberk
  shield: 22322, // Avernic defender
  legs: 24421, // Inquisitor's plateskirt
  hands: 22981, // Ferocious gloves
  boots: 31097, // Avernic treads (max)
  ring: 28307, // Ultor ring
};
const { shield: _defender, ...withoutShield } = armour;
const supplies = {
  equippedAmmo: { id: 22947 }, // Rada's blessing 4
  quiverAmmo: null,
  runePouch: null,
  blowpipe: null,
  selectedSpell: null,
  spellbook: "standard",
};

export const phosanisNightmareLoadouts = {
  inquisitors_mace: {
    name: "Melee (Inquisitor's mace)",
    equipment: { ...armour, weapon: 24417 }, // Inquisitor's mace
    inventory: inventory(),
    supplies,
  },
  scythe: {
    name: "Melee (Scythe of Vitur)",
    equipment: { ...withoutShield, weapon: 22325 }, // Scythe of Vitur (two-handed: no defender)
    inventory: inventory(24417), // with the mace for the husks and parasites
    supplies,
  },
};
