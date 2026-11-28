// Scurrius' default loadouts (the descriptor's `loadouts`, encounters/registry.js): the six setups of the wiki's
// strategy guide (Scurrius/Strategies, revision of 23 November 2026), "Low/Mid Level" and "High Level" for each style,
// each slot the guide's first pick the client has. The guide recommends 50+ in each combat stat and 43 Prayer.
//
// Where a setup differs from the guide's first picks:
// - Void Knight equipment is left out (the guide's picks for it hold only with the full set): the next pick.
// - "Blessed" d'hide (coif, body, chaps, bracers, boots): the Saradomin set.
// - Ranged, high level: the ascension crossbows are not in the client, and the toxic blowpipe needs darts; the bone
//   shortbow, the guide's next pick, with its seeking amethyst arrows.
// - Magic, high level: the bone staff of the guide's "Tumeken's shadow / Bone staff", with Elidinis' ward (f).
// - Inventories: the guide's potions and food the client can use; super combat potions for its super attack,
//   strength and defence; no magic potions or super defence (not drinkable here), runes, Book of the Dead, holy
//   wrench or teleport. The dragon dagger(p++) is left out (no weapon category on main: it punches); the dragon claws
//   of the high melee setup are there.
const item = {
  prayerPotion: 2434, // Prayer potion(4)
  karambwan: 3144, // Cooked karambwan
  superCombat: 12695, // Super combat potion(4)
  divineSuperCombat: 23685, // Divine super combat potion(4)
  ranging: 2444, // Ranging potion(4)
  divineRanging: 23733, // Divine ranging potion(4)
  superRestore: 3024, // Super restore(4)
  brew: 6685, // Saradomin brew(4)
  saturatedHeart: 27641, // Saturated heart
  boneMace: 28792,
  boneShortbow: 28794,
  boneStaff: 28796,
  dragonClaws: 13652,
};
const many = (id, count) => Array(count).fill(id);
const standard = { selectedSpell: null, spellbook: "standard" };
// A blessing in the ammunition slot, as the other encounters' loadouts wear one.
const blessed = (id) => ({ ...standard, equippedAmmo: { id } });
const RADAS_BLESSING_3 = 22945;
const RADAS_BLESSING_4 = 22947;
// The guide's low and mid level inventories: their potions, prayer potions, and karambwans to fill.
const midInventory = (...first) => [...first, ...many(item.karambwan, 28 - first.length)];
// The high level ones: three super restores and four brews after the potions and prayer potions.
const highInventory = (...first) => [...first, ...many(item.superRestore, 3), ...many(item.brew, 4)];

export const scurriusLoadouts = {
  mid_melee: {
    name: "Melee (mid level)",
    equipment: {
      head: 10828, // Helm of neitiznot
      cape: 6570, // Fire cape
      amulet: 6585, // Amulet of fury
      weapon: item.boneMace,
      body: 10551, // Fighter torso
      shield: 12954, // Dragon defender
      legs: 4087, // Dragon platelegs
      hands: 7462, // Barrows gloves
      boots: 11840, // Dragon boots
      ring: 11773, // Berserker ring (i)
    },
    inventory: midInventory(item.superCombat, ...many(item.prayerPotion, 4)),
    supplies: blessed(RADAS_BLESSING_3),
  },
  mid_ranged: {
    name: "Ranged (mid level)",
    equipment: {
      head: 10390, // Saradomin coif
      cape: 10499, // Ava's accumulator
      amulet: 6585, // Amulet of fury
      weapon: item.boneShortbow,
      body: 10386, // Saradomin d'hide body
      legs: 10388, // Saradomin chaps
      hands: 10384, // Saradomin bracers
      boots: 19933, // Saradomin d'hide boots
      ring: 11771, // Archers ring (i)
    },
    inventory: midInventory(...many(item.ranging, 2), ...many(item.prayerPotion, 5)),
    supplies: { ...standard, equippedAmmo: { id: 21326 } }, // Amethyst arrow
  },
  mid_magic: {
    name: "Magic (mid level)",
    equipment: {
      head: 25413, // Bloodbark helm
      cape: 2412, // Saradomin cape
      amulet: 12002, // Occult necklace
      weapon: item.boneStaff,
      body: 25404, // Bloodbark body
      shield: 11924, // Malediction ward
      legs: 25416, // Bloodbark legs
      hands: 7460, // Rune gloves
      boots: 25410, // Bloodbark boots
      ring: 23624, // Seers ring (i)
    },
    inventory: midInventory(...many(item.prayerPotion, 4)),
    supplies: blessed(RADAS_BLESSING_3),
  },
  high_melee: {
    name: "Melee (high level)",
    equipment: {
      head: 30302, // Torva full helm
      cape: 23622, // Infernal cape
      amulet: 29801, // Amulet of rancour
      weapon: 22325, // Scythe of Vitur
      body: 30303, // Torva platebody
      legs: 30304, // Torva platelegs
      hands: 22981, // Ferocious gloves
      boots: 31088, // Avernic treads
      ring: 28307, // Ultor ring
    },
    // The bone mace for his rats, the claws for their special.
    inventory: highInventory(item.boneMace, ...many(item.divineSuperCombat, 3), item.dragonClaws, ...many(item.prayerPotion, 12)),
    supplies: blessed(RADAS_BLESSING_4),
  },
  high_ranged: {
    name: "Ranged (high level)",
    equipment: {
      head: 27235, // Masori mask (f)
      cape: 28951, // Dizana's quiver
      amulet: 33639, // Necklace of rupture
      weapon: item.boneShortbow,
      body: 27238, // Masori body (f)
      legs: 27241, // Masori chaps (f)
      hands: 26235, // Zaryte vambraces
      boots: 31088, // Avernic treads
      ring: 28310, // Venator ring
    },
    inventory: highInventory(...many(item.divineRanging, 3), ...many(item.prayerPotion, 12)),
    supplies: { ...standard, equippedAmmo: { id: 33589 } }, // Seeking amethyst arrow
  },
  high_magic: {
    name: "Magic (high level)",
    equipment: {
      head: 21018, // Ancestral hat
      cape: 23607, // Imbued Saradomin cape
      amulet: 12002, // Occult necklace
      weapon: item.boneStaff,
      body: 21021, // Ancestral robe top
      shield: 27251, // Elidinis' ward (f)
      legs: 21024, // Ancestral robe bottom
      hands: 31106, // Confliction gauntlets
      boots: 31088, // Avernic treads
      ring: 28313, // Magus ring
    },
    inventory: highInventory(item.saturatedHeart, ...many(item.prayerPotion, 15)),
    supplies: blessed(RADAS_BLESSING_4),
  },
};
