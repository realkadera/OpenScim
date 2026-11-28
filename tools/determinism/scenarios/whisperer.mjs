// The Whisperer (client/encounters/whisperer/). The player arrives south of the Odd Figure, walks up to her and
// disturbs her; test/test-whisperer.mjs reads what follows off these runs.
import { attack, magicGear, protect, use } from "./common.mjs";

const KIND = "whisperer";
const BOSS = "whisperer";
const fragment = 28357; // CACHE BLACKSTONE_FRAGMENT
const fragmentActive = 28356;
const prayerPotion = 2434; // and its 3, 2 and 1 doses
const prayerDoses = [2434, 139, 141, 143];
const disturb = (api) => attack(api, BOSS);
// A click on a tile: the player stops attacking and walks there.
function walk(api, tile) {
  if (api.player().attackTarget !== null) attack(api, null);
  api.moveTo(...tile);
}

// The fight as a script sees it: her snapshot's state.
const fight = (api) => api.engine.getEncounterSnapshot().state;
const fragmentSlot = (api) => api.player().inventory.findIndex((item) => item && (item.id === fragment || item.id === fragmentActive));
const distance = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// Beside her 3 x 3, not on a diagonal: where she melees.
function besideHer(her, [x, y]) {
  const dx = Math.max(her.position[0] - x, x - (her.position[0] + her.size - 1), 0);
  const dy = Math.max(her.position[1] - y, y - (her.position[1] + her.size - 1), 0);
  return dx + dy === 1;
}

// Is the player on a tentacle's line? It rises four tiles off, straight or diagonally, and lashes at the tile they
// stood on; its middle is a tile in from its corner.
const onTentacleLine = (api, [x, y]) =>
  api.npcs().some((npc) => {
    if (!npc.id.startsWith("whisperer-tentacle-")) return false;
    const dx = Math.abs(npc.position[0] + 1 - x), dy = Math.abs(npc.position[1] + 1 - y);
    return (dx === 0 || dx === 4) && (dy === 0 || dy === 4) && dx + dy > 0;
  });

// A player who plays the specials: into the Shadow Realm as the fragment glows, the light seeds stomped nearest first,
// behind a column for each screech, the souls killed; and out again with her.
function playSpecials(tick, api) {
  const state = fight(api);
  const special = state.special;
  if (!special?.active) return false;
  if (special.switchAllowed && !state.shadow && tick % 2 === 0) use(api, fragmentSlot(api));
  const player = api.player();
  if (special.kind === "seeds" && state.shadow) {
    const light = special.seeds.filter((seed) => seed.light).sort((a, b) => distance(a.at, player.position) - distance(b.at, player.position))[0];
    if (light) walk(api, light.at);
  } else if (special.kind === "screech") {
    // WIKI: behind the weakest column first, so that the strongest are left for the last screeches; of the weakest,
    // the one nearest the strongest, for a short walk to the next.
    const strongest = [...special.columns].sort((a, b) => b.hp - a.hp)[0];
    const column = [...special.columns].sort((a, b) => a.hp - b.hp || distance(a.at, strongest.at) - distance(b.at, strongest.at))[0];
    if (column) walk(api, [column.at[0], column.at[1] + 2]);
  } else if (special.kind === "souls" && state.shadow) {
    const soul = api.npcs().filter((npc) => npc.id.startsWith("whisperer-soul-")).sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))[0];
    if (soul && player.attackTarget !== soul.id) attack(api, soul.id);
  }
  return true;
}

export const scenarios = [
  {
    // Disturbed from her north side, where the player arrives: flung 3 tiles north, then her volleys and tentacles
    // on a player who stands still, unprotected. Infinite health: to the end.
    name: "whisperer/standing",
    kind: KIND,
    seed: 3,
    ticks: 90,
    mechanics: { infiniteHealth: true },
    script(tick, api) {
      if (tick === 1) disturb(api);
      if (tick === 20) api.moveTo(...api.player().position);
    },
  },
  {
    // The guide's magic setup, praying against magic, through every special to the enrage and the kill.
    name: "whisperer/kill",
    kind: KIND,
    seed: 11,
    ticks: 700,
    mechanics: { infiniteHealth: true },
    ...magicGear,
    inventory: [fragment, prayerPotion, prayerPotion, prayerPotion, prayerPotion, prayerPotion, prayerPotion, prayerPotion, prayerPotion],
    script(tick, api) {
      if (tick === 1) disturb(api);
      if (tick === 2) protect(api, "ProtectMagic");
      const state = fight(api);
      if (state.phase === "asleep" || state.phase === "dead") return;
      // A dose of prayer when it runs low.
      const potion = api.player().inventory.findIndex((item) => item && prayerDoses.includes(item.id));
      if (api.player().prayerState.points < 30 && potion >= 0 && tick % 3 === 0) use(api, potion);
      if (playSpecials(tick, api)) return;
      // Out of her melee: four tiles north of her.
      const her = api.npcs().find((npc) => npc.id === BOSS);
      if (her && besideHer(her, api.player().position)) {
        walk(api, [api.player().position[0], her.position[1] + her.size + 3]);
        return;
      }
      // A tile aside, off a tentacle's line.
      const player = api.player();
      if (onTentacleLine(api, player.position)) {
        walk(api, [player.position[0] + (player.position[0] < 32 ? 1 : -1), player.position[1]]);
        return;
      }
      if (player.attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The awakened version, standing still and praying against magic: its five-shot volleys.
    name: "whisperer/awakened-volleys",
    kind: "whisperer_awakened",
    seed: 5,
    ticks: 60,
    mechanics: { infiniteHealth: true },
    script(tick, api) {
      if (tick === 1) disturb(api);
      if (tick === 2) protect(api, "ProtectMagic");
    },
  },
];
