// Nex's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Nex/Strategies, "Equipment": "Recommended Ranged"): the best of each slot the client has.
// - Ranged (Zaryte crossbow): the guide's first weapon, the Zaryte crossbow, with ruby dragon bolts (e) (its diamond
//   ascension bolts (e) go with the ascension crossbows, which the client lacks). Masori (f), the necklace of
//   rupture, Blessed Dizana's quiver, Zaryte vambraces, Avernic treads (max), the Twisted buckler and Venator ring.
// - Ranged (Twisted bow): the guide's next weapon, with dragon arrows, in the same armour (two-handed: no buckler).
// Both carry what the guide says the fight needs: Osmumten's fang to break an ice prison's stalagmites ("at least two
// players should carry a stab or crush weapon"), the Book of the Dead for thralls, and its inventory's potions:
// divine ranging, Sanfew serum, super restores and Saradomin brews (the guide's grid gives no numbers).
const fang = 26219; // Osmumten's fang
const bookOfTheDead = 25818;
const runePouch = 27281; // Divine rune pouch
const potions = [23733, 10925, 10925, 3024, 3024, 3024, 3024, 3024]; // divine ranging, two Sanfew serums, five super restores
const brews = (n) => Array.from({ length: n }, () => 6685); // Saradomin brew(4)
const armour = {
  head: 27235, // Masori mask (f)
  cape: 28955, // Blessed Dizana's quiver
  amulet: 33639, // Necklace of rupture
  body: 27238, // Masori body (f)
  legs: 27241, // Masori chaps (f)
  hands: 26235, // Zaryte vambraces
  boots: 31097, // Avernic treads (max)
  ring: 28310, // Venator ring
};

export const nexLoadouts = {
  zaryte_crossbow: {
    name: "Ranged (Zaryte crossbow)",
    equipment: { ...armour, weapon: 26374, shield: 21000 }, // Zaryte crossbow, Twisted buckler
    inventory: [fang, bookOfTheDead, runePouch, ...potions, ...brews(17)],
    supplies: {
      equippedAmmo: { id: 21944 }, // Ruby dragon bolts (e)
      // WIKI: the inventory's blood, aether, fire and death runes (thralls and Death Charge).
      runePouch: { kind: "divine", slots: [{ id: 554 }, { id: 565 }, { id: 30843 }, { id: 560 }] },
      selectedSpell: null,
      spellbook: "arceuus",
    },
  },
  twisted_bow: {
    name: "Ranged (Twisted bow)",
    equipment: { ...armour, weapon: 20997 }, // Twisted bow
    inventory: [fang, bookOfTheDead, runePouch, ...potions, ...brews(17)],
    supplies: {
      equippedAmmo: { id: 11212 }, // Dragon arrow
      runePouch: { kind: "divine", slots: [{ id: 554 }, { id: 565 }, { id: 30843 }, { id: 560 }] },
      selectedSpell: null,
      spellbook: "arceuus",
    },
  },
};
