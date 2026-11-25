// Zebak (Tombs of Amascut). The encounter is client/toa/zebak/*.js; together
// these fights run every part of it that player inputs reach, and the engine
// paths that exist only for it (jug actions, the tide, Tombs-only weapons).
//
// The arena: Zebak fills x 14-22, y 28-36 and faces east. The platform is
// x 22-38, y 22-42; column 23 beside him is the bite row. A Great Roar is
// survived on the one to three tiles east of a rock, on its row. Tidal Waves
// start at y 21 (first time, moving north) or y 43 (second time, moving south)
// and leave a gap of 3, 2 or 1 tiles by path level; a player they carry off
// the platform is in the water until he wades to the ramp at x 30.
//
// Timing, at path 0: Zebak acts first on tick 4 and then every 7 ticks. A
// special's rocks, jugs and acid land 6 ticks after it starts; the roar's
// three pulses come 37, 39 and 41 ticks after a first roar starts (32, 34, 36
// after a second); the three crests appear 14, 21 and 28 ticks after the
// waves start and move one row a tick. Specials are queued when his hitpoints
// cross 85%, 70%, 55% and 40%; under 25% he is enraged. Which special comes
// first, the layouts and the gaps follow from the seed, so the tick numbers
// and tiles in the scripts below are those of each scenario's seed.
//
// The scripts read the encounter snapshot and fields of the actors that have
// real names (position, facing, npcTypeId, archetypeId, vitals, attackTarget,
// inventory). Nothing is read from api.engine.encounter.
import { attack, boss, command, equip, item, magicGear, meleeGear, offensive, protect, rangedGear, setBossHp, special, toggleRun, use } from "./common.mjs";

const ZEBAK = "zebak";
/** In the Tombs: more accurate when the target is under 25%, heals on a kill, and its special is Tumeken's Light. */
const KERIS_PARTISAN_OF_THE_SUN = 27291;
/** Its special heals the player: an effect on the target's debuffs that is not a Defence drain. */
const SARADOMIN_GODSWORD = 11806;
/** Its special drains Defence by the damage dealt; Zebak's Defence drain is capped at 20. */
const BANDOS_GODSWORD = 11804;
/** A powered staff of the Tombs; needs 70 Magic. Its special, Condemn, drains Magic and Defence. */
const ACCURSED_SCEPTRE = 27665;
/** Its arrows bounce to other monsters in reach: the engine asks the encounter about every candidate (only Zebak is one). */
const VENATOR_BOW = 27610;
const rune = { water: 555, death: 560, blood: 565 };
const level = (value) => ({ current: value, max: value });
const maxedStats = { attack: level(99), strength: level(99), defence: level(99), ranged: level(99), magic: level(99), prayer: level(99), hitpoints: level(99), agility: level(99) };
/** The twisted bow reaches Zebak (east edge x 22, range 10) from this column or further west. */
const BOW_REACH_X = 32;
/** A jug's NPC type while it rolls (11735 at rest). */
const ROLLING_JUG = 11736;

/** { special, enraged, waveShove, acid, splashes, queued, bloodTrail } */
const state = (api) => api.engine.getEncounterSnapshot().state;
/** The living objects of the fight: "rock" | "jug" | "wave" | "cloud". */
const objects = (api, kind) => api.npcs().filter((npc) => npc.archetypeId === "zebak-" + kind);
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const onAcid = (api, tile) => state(api).acid.some((pool) => sameTile(pool, tile));
const jugAt = (api, x, y) => objects(api, "jug").find((jug) => sameTile(jug.position, [x, y]))?.id;
/** That share of Zebak's full hitpoints, for setBossHp. */
const bossHp = (api, share) => Math.floor(boss(api).vitals.maxHp * share);

/** A click on a tile: drops the attack target and walks there. */
function walkTo(api, x, y) {
  api.act({ type: "attackTarget", targetId: null });
  api.moveTo(x, y);
}
/** "Push" | "Pull" | "Hit" on a jug: what its menu sends (a rolling jug's "Attack" is sent as "Hit"). */
const jugAction = (api, action, id) => command(api, { encounter: ZEBAK, action, id });

/** The tile nearest to `from` (west and south first) in the middle of the platform that `accept` takes. */
function nearestTile([fromX, fromY], accept) {
  for (let radius = 0; radius <= 12; radius++)
    for (let x = fromX - radius; x <= fromX + radius; x++)
      for (let y = fromY - radius; y <= fromY + radius; y++) {
        const onRing = Math.max(Math.abs(x - fromX), Math.abs(y - fromY)) === radius;
        if (onRing && x >= 24 && x <= 36 && y >= 26 && y <= 38 && accept([x, y])) return [x, y];
      }
  return null;
}

/** Great Roar: a tile sheltered by a rock and within bow range, off the acid if one is. Null without rocks. */
function shelterTile(api) {
  const position = api.player().position;
  const rocks = objects(api, "rock").map((rock) => rock.position);
  const sheltered = ([x, y]) => x <= BOW_REACH_X && rocks.some(([rockX, rockY]) => y === rockY && x > rockX && x <= rockX + 3);
  const free = (tile) => sheltered(tile) && !rocks.some((rock) => sameTile(rock, tile));
  return nearestTile(position, (tile) => free(tile) && !onAcid(api, tile)) ?? nearestTile(position, free);
}

/** Tidal Waves: the platform columns that the crest on `row` leaves open. */
function gapOf(api, row) {
  const crest = new Set(objects(api, "wave").filter((wave) => wave.position[1] === row).map((wave) => wave.position[0]));
  return Array.from({ length: 17 }, (_, index) => 22 + index).filter((x) => !crest.has(x));
}

/** Tidal Waves: a tile in the gap of the next crest to reach the player, off the acid. Null when none is coming. */
function gapTile(api) {
  const position = api.player().position;
  const waves = objects(api, "wave");
  const direction = waves[0]?.facing === 1024 ? 1 : -1; // crests that come from the south face north
  const ahead = waves.filter((wave) => (position[1] - wave.position[1]) * direction > 0);
  if (!ahead.length) return null;
  const row = ahead.reduce((a, b) => ((a.position[1] - b.position[1]) * direction > 0 ? a : b)).position[1];
  const gap = gapOf(api, row);
  return nearestTile(position, ([x, y]) => gap.includes(x) && (y - row) * direction > 0 && !onAcid(api, [x, y]));
}

/** Where to step when the player stands in acid: the nearest clean tile within bow range. Null on clean ground. */
function cleanTile(api) {
  const position = api.player().position;
  return onAcid(api, position) ? nearestTile(position, (tile) => !onAcid(api, tile) && tile[0] <= BOW_REACH_X) : null;
}

/** Walks into the gap of the coming crest, or else out of acid. False when there is nowhere to go. */
function dodge(api) {
  const refuge = gapTile(api) ?? cleanTile(api);
  if (refuge) walkTo(api, ...refuge);
  return refuge !== null;
}

/** A fight as a careful player has it: Rigour and one protection prayer at a time, an anglerfish when low,
 *  behind a rock for a Great Roar, in the gaps of the Tidal Waves, off the acid, shooting whenever in place. */
function carefulRangedFight(tick, api) {
  if (tick === 1) (offensive(api, "Rigour"), protect(api, "ProtectMagic"));
  if (tick === 80) protect(api, "ProtectRange");
  const player = api.player();
  const food = player.inventory.findIndex((slot) => slot?.id === item.anglerfish);
  if (player.vitals.hp <= 55 && food >= 0) use(api, food);
  const refuge = (state(api).special === "roar" ? shelterTile(api) : gapTile(api)) ?? cleanTile(api);
  if (refuge && !sameTile(player.position, refuge)) walkTo(api, ...refuge);
  else if (player.attackTarget !== ZEBAK && player.position[0] <= BOW_REACH_X) attack(api, ZEBAK);
}

export const scenarios = [
  {
    // The default fight to victory on real hitpoints: both spit styles prayed against and not, the first
    // Tidal Waves stood out in their gaps, a Great Roar sheltered from and cut short by enrage, the enraged
    // spits, the kill of head and tail and the spits that still land afterwards.
    name: "zebak/careful-ranged-kill",
    kind: "zebak",
    seed: 1,
    ticks: 200,
    ...rangedGear,
    inventory: [item.anglerfish, item.anglerfish],
    script: carefulRangedFight,
  },
  {
    // Both Great Roars and the Tidal Waves between them, with every jug input: hit from range (twice, and
    // once more when it is gone), pushed into the water, pulled six tiles, pushed into a rock, pushed from
    // its own tile, a pull abandoned, a rolling jug shot, a shot that waits for the bow, jugs left to the
    // roar; acid stood in and washed off by jugs and crests; a rock shot at; the first pulse taken in the
    // open, the others behind a rock.
    name: "zebak/roar-jugs",
    kind: "zebak",
    seed: 2,
    ticks: 136,
    mechanics: { infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      // 55%: three thresholds at once, so a roar, the waves and the second roar are queued.
      if (tick === 1) setBossHp(api, bossHp(api, 0.55));

      // First roar: starts tick 4, objects land tick 10, pulses on ticks 41, 43 and 45.
      // Rocks (24,29) (25,30); jugs (25,27) (27,26) (35,26) (35,31) (36,33) (34,37) (33,38).
      if (tick === 11) jugAction(api, "Hit", jugAt(api, 35, 31)); // six tiles away: the arrow takes 3 ticks
      if (tick === 12) jugAction(api, "Hit", jugAt(api, 35, 31)); // already doomed: accepted, changes nothing
      if (tick === 13) walkTo(api, 35, 33);
      if (tick === 15) jugAction(api, "Hit", "zebak-jug-6"); // the jug shot on tick 11, which has just shattered
      if (tick === 16) jugAction(api, "Push", jugAt(api, 36, 33)); // east: two tiles, then off the platform
      if (tick === 18) walkTo(api, 34, 36);
      if (tick === 20) jugAction(api, "Pull", jugAt(api, 34, 37)); // rolls south over the player, six tiles
      if (tick === 26) walkTo(api, 32, 34); // an acid pool: stands in it for five ticks
      if (tick === 31) walkTo(api, 29, 30);
      if (tick === 34) attack(api, objects(api, "rock")[0].id); // a rock can be shot at and never hit
      if (tick === 40) jugAction(api, "Push", jugAt(api, 35, 26)); // too far: the roar breaks it first
      // Tick 41: the first pulse hits in the open. Behind the rock at (25,30) for the other two.
      if (tick === 42) walkTo(api, 27, 30);

      // Tidal Waves: start tick 47 from the south, crests on ticks 61, 68 and 75. Stands in each gap.
      if (tick >= 47 && tick < 98) dodge(api);

      // Second roar: starts tick 91 while crests are still crossing, objects land tick 97,
      // pulses on ticks 123, 125 and 127. Rocks (30,32) (30,34) (29,35);
      // jugs (27,31) (27,36) (28,38) (31,25) (33,26) (32,38) (36,33).
      if (tick === 98) walkTo(api, 26, 30);
      if (tick === 100) jugAction(api, "Push", jugAt(api, 27, 31)); // north-east, into the rock at (30,34)
      if (tick === 101) jugAction(api, "Pull", jugAt(api, 36, 33)); // sets off towards it ...
      if (tick === 103) walkTo(api, 27, 36); // ... and clicks away: the pull is dropped. Onto a jug's tile.
      if (tick === 107) jugAction(api, "Push", jugAt(api, 27, 36)); // from its own tile: a shove, no roll
      if (tick === 108) walkTo(api, 29, 38);
      if (tick === 110) jugAction(api, "Push", jugAt(api, 28, 38)); // rolls west
      if (tick === 111) jugAction(api, "Hit", objects(api, "jug").find((jug) => jug.npcTypeId === ROLLING_JUG).id); // shot as it rolls
      if (tick === 112) jugAction(api, "Hit", jugAt(api, 36, 33)); // waits four ticks for the bow
      if (tick === 118) walkTo(api, ...shelterTile(api)); // behind a rock for all three pulses
    },
  },
  {
    // Tidal Waves from both shores, by the rules of a recording (rev 243): a crest strikes the player's
    // true tile before it steps. Struck while attacking and thrown 3 tiles; a crest run through and one
    // walked through, both untouched (the wave skip); a crest that catches him, strikes him twice and
    // throws him off the platform into the water; bitten by the crocodile with and without Protect from Melee, a
    // spell cast from the water, a jug action refused there, the wade along the shore and out by the
    // ramp. A roar that starts while crests still cross, a jug broken with an autocast spell, a second
    // set of crests that throws him off the southern edge, and enrage while they are out.
    name: "zebak/waves-swept",
    kind: "zebak",
    seed: 5,
    ticks: 156,
    mechanics: { infiniteHealth: true },
    equipment: { ...magicGear.equipment, weapon: item.kodaiWand },
    supplies: { spellbook: "ancient", selectedSpell: "Ice Barrage" },
    inventory: [rune.blood, rune.death, rune.water],
    script(tick, api) {
      // 70%: Tidal Waves, then a Great Roar. The waves start on tick 4 from the south; crests rise on
      // row 21 on ticks 18, 25 and 32, a row a tick, each with its gap in columns 32-34.
      if (tick === 1) setBossHp(api, bossHp(api, 0.7));

      // First crest: steps onto row 32 on tick 29 with the player attacking on it, strikes him on
      // tick 30 and throws him to (29,35), which drops his target. Left there, it would strike him
      // again on tick 33. On tick 32 it steps onto his row as he runs two tiles through it, to (29,33):
      // he is never on its tile when it strikes.
      if (tick === 27) attack(api, ZEBAK);
      if (tick === 32) walkTo(api, 29, 33);
      // Second crest: on row 32 below him after tick 36. He walks one tile through it as it steps
      // onto his row, onto the row it leaves.
      if (tick === 37) walkTo(api, 29, 32);
      // Third crest: run ahead of (it steps onto row 32 on tick 43 as he leaves it), then caught on
      // row 36 as he walks east along it: struck on tick 48 and thrown to (35,39). The throw drops
      // his click, so he stands there, is struck again on tick 51 with one tile of platform left, and
      // is thrown off it, into the water at (35,41).
      if (tick === 43) walkTo(api, 29, 36);
      if (tick === 45) walkTo(api, 36, 37);

      // In the water a crocodile bites every fourth tick, and the only way is along the shore.
      if (tick === 53) protect(api, "ProtectMelee");
      if (tick === 54) walkTo(api, 31, 43); // wades west to the shore tile of this column and stops on it
      if (tick === 61) attack(api, ZEBAK); // casts from the water: always a miss
      if (tick === 62) jugAction(api, "Hit", objects(api, "jug")[0].id); // refused in the water
      if (tick === 65) protect(api, "ProtectMelee"); // off again
      if (tick === 66) walkTo(api, 30, 36); // one more tile west, then up the ramp

      // The Great Roar started on tick 48 with two crests still crossing; pulses on ticks 85, 87 and 89.
      if (tick === 70) setBossHp(api, bossHp(api, 0.55)); // the second Tidal Waves are queued
      if (tick === 74) jugAction(api, "Hit", objects(api, "jug")[0].id); // a jug broken with Ice Barrage
      if (tick === 78) walkTo(api, ...shelterTile(api));

      // Second waves: start tick 91 from the north; crests on row 43 on ticks 105, 112 and 119.
      if (tick === 92) walkTo(api, 30, 34);
      if (tick >= 105 && tick < 119) dodge(api); // lets the first crest pass in its gap
      if (tick === 120) walkTo(api, 36, 26); // in the second crest's way, two tiles from the southern edge:
      // struck on tick 130 and thrown off the platform, into the water on row 23
      if (tick === 137) setBossHp(api, 140); // under 25%: enrage, the crests still out vanish
      if (tick === 139) walkTo(api, 30, 30); // out by the southern ramp
    },
  },
  {
    // Melee from the bite row with the Keris partisans: bites with and without Protect from Melee, a bite
    // taken one step back, one run away from and one dodged by stepping under Zebak (who then spits at the
    // player inside him); the bleed while standing, running and walking and its blood trail; enrage and
    // the enraged bite. Then the partisan of the sun: Tumeken's Light and both of its refusals, the extra
    // accuracy under 25% and the heal on the kill.
    name: "zebak/melee-bite-bleed",
    kind: "zebak",
    seed: 13,
    ticks: 100,
    mechanics: { infiniteHealth: true },
    ...meleeGear,
    equipment: { ...meleeGear.equipment, weapon: item.kerisPartisanOfCorruption },
    inventory: [KERIS_PARTISAN_OF_THE_SUN, item.superRestore],
    script(tick, api) {
      // Zebak bites instead of spitting when the player is in the bite row as he acts: ticks 4, 11, 18, ...
      // A bite lands a tick later. With this seed the first two start a bleed (14 ticks each).
      if (tick === 1) attack(api, ZEBAK); // walks up to (23,32)
      if (tick === 12) protect(api, "ProtectMelee");
      if (tick === 13) walkTo(api, 27, 32); // bleeding: runs two ticks (the trail takes both tiles of a run step)
      if (tick === 15) (toggleRun(api), walkTo(api, 23, 32)); // and walks back; off the row on tick 18, so a spit
      if (tick === 19) attack(api, ZEBAK);
      if (tick === 32) walkTo(api, 24, 32); // one step back as he bites: still within the bite
      if (tick === 34) attack(api, ZEBAK);
      if (tick === 39) (toggleRun(api), walkTo(api, 26, 32)); // three tiles back as he bites: out of it
      if (tick === 41) attack(api, ZEBAK);
      if (tick === 46) walkTo(api, 22, 32); // under Zebak as he bites: the bite cannot land there
      // Tick 53: the player is not in the bite row but inside him, so he spits.
      if (tick === 54) attack(api, ZEBAK); // steps out from under him to stab
      if (tick === 55) setBossHp(api, 140); // under 25%: enrage
      if (tick === 56) (equip(api, 0, "weapon"), attack(api, ZEBAK)); // the partisan of the sun
      if (tick === 58) special(api); // Tumeken's Light: 75% energy and 50 prayer
      if (tick === 60) special(api); // refused: under 50 prayer
      if (tick === 61) (use(api, 1), attack(api, ZEBAK)); // super restore
      if (tick === 64) special(api); // refused: 25% energy left
      if (tick === 70) protect(api, "ProtectMelee"); // off: enraged bites every 4 ticks, unprotected
      if (tick === 80) setBossHp(api, 1); // the next stab kills and heals
    },
  },
  {
    // Not Just a Head alone: the one large blood cloud comes for the player, feeds on him and heals
    // Zebak, is cast at in vain, is held up behind a roar's rock, and dies of the distance when the
    // player runs; then a Blood Barrage, which heals Zebak by twice its damage.
    name: "zebak/blood-cloud",
    kind: "zebak",
    seed: 3,
    ticks: 135,
    mechanics: { infiniteHealth: true, blood: true },
    ...magicGear,
    script(tick, api) {
      // Every sixth spit outside a special is a blood spell: the cloud (tick 39, out on tick 42),
      // then two barrages. Two casts of the shadow first, so that Zebak has hitpoints to regain.
      if (tick === 1) attack(api, ZEBAK);
      if (tick === 8) walkTo(api, 36, 38); // the cloud appears at (29,24) and reaches the player on tick 56
      if (tick === 57) attack(api, objects(api, "cloud")[0].id); // a cloud can be cast at and never hit
      if (tick === 58) setBossHp(api, bossHp(api, 0.85)); // a Great Roar: starts tick 60, rocks land tick 66
      // To the bite row, west of the rock at (24,29): the cloud follows and is stuck east of the rock
      // from tick 78 until the rocks go on tick 103. Bitten there, and hit by all three pulses.
      if (tick === 67) walkTo(api, 23, objects(api, "rock")[0].position[1]);
      if (tick === 104) walkTo(api, 36, 38); // runs: the cloud loses 2 hitpoints a step and dies on tick 109
      // Tick 127: the Blood Barrage of the twelfth counted spit.
    },
  },
  {
    // Every invocation but Upset Stomach, at path 6: Quiet Prayers lets a tenth of a prayed spit and
    // barrage through, Blood Thinners sends three small clouds (once out of reach of the player, wandering
    // until they die; once feeding on him), Arterial Spray makes barrage and clouds heal Zebak more. The
    // fast spits, the fast enraged spits every 2 ticks, the venator bow (whose bounce finds no second
    // target here), and a kill by the debug hitpoints control with clouds out.
    name: "zebak/blood-spray-thinners-path6",
    kind: "zebak",
    seed: 1,
    ticks: 140,
    mechanics: { infiniteHealth: true, path: "6", quiet: true, blood: true, spray: true, clouds: true },
    ...rangedGear,
    equipment: { ...rangedGear.equipment, weapon: VENATOR_BOW },
    script(tick, api) {
      // Spits every 5 ticks. The first clouds appear on tick 32 on the north shore, 17 tiles from here:
      // too far to notice the player.
      if (tick === 1) (offensive(api, "Rigour"), walkTo(api, 30, 23));
      if (tick === 36) walkTo(api, 28, 34);
      if (tick === 40) attack(api, ZEBAK); // three arrows
      if (tick === 52) walkTo(api, 28, 34);
      if (tick === 55) setBossHp(api, 200); // under 25%: enraged, every eighth spit is now a blood spell
      // Tick 69: a barrage unprayed; Zebak regains three times its damage.
      if (tick === 75) protect(api, "ProtectMagic"); // tick 85: a barrage prayed against
      // Tick 101: the second clouds, on the south shore, within reach; on the player from tick 112.
      if (tick === 110) attack(api, objects(api, "cloud")[0].id);
      if (tick === 113) attack(api, ZEBAK);
      if (tick === 120) setBossHp(api, 0); // killed outright, three clouds still feeding
    },
  },
  {
    // Upset Stomach at path 3, in melee: wider acid and a smaller jug splash, the 6-tick spits, the
    // earlier roar, the 2-tile gap. A jug walked up to and hit with a sword, acid stood in, both
    // godsword specials (the Bandos one drains more Defence than Zebak allows), all three pulses of the
    // first roar sheltered from (in acid: no sheltered tile is clean) and of the second taken in the
    // open. Arterial Spray and Blood Thinners are on without Not Just a Head, which leaves them off.
    name: "zebak/upset-stomach-path3",
    kind: "zebak",
    seed: 2,
    ticks: 122,
    intro: true, // Zebak has no intro; the engine asks him
    mechanics: { infiniteHealth: true, path: "3", upset: true, spray: true, clouds: true },
    equipment: { ...meleeGear.equipment, weapon: SARADOMIN_GODSWORD, shield: undefined },
    inventory: [BANDOS_GODSWORD],
    script(tick, api) {
      // 55%: roar (starts tick 4, pulses on ticks 38, 40, 42), waves (tick 44; crests on ticks 58, 65, 72),
      // second roar (tick 84; pulses on ticks 113, 115, 117).
      if (tick === 1) (setBossHp(api, bossHp(api, 0.55)), offensive(api, "Piety"), special(api), attack(api, ZEBAK));
      if (tick === 5) equip(api, 0, "weapon");
      if (tick === 6) (special(api), attack(api, ZEBAK));
      if (tick === 11) jugAction(api, "Hit", objects(api, "jug")[0].id); // walks round the rock to the jug at (25,27)
      if (tick === 18) walkTo(api, ...nearestTile(api.player().position, (tile) => onAcid(api, tile)));
      if (tick === 22) attack(api, ZEBAK); // back to the bite row
      if (tick === 33) walkTo(api, ...shelterTile(api));
      if (tick >= 44) dodge(api);
    },
  },
  {
    // A long fight to victory on real hitpoints at path 5 and raid level 50: the 5-tick fast spits, both
    // roars and both waves (1-tile gaps) handled as a careful player does, anglerfish eaten, prayer run
    // dry, enrage with the second waves out.
    name: "zebak/careful-kill-path5",
    kind: "zebak",
    seed: 13,
    ticks: 300,
    mechanics: { path: "5", other: "50" },
    ...rangedGear,
    inventory: Array(26).fill(item.anglerfish),
    script: carefulRangedFight,
  },
  {
    // The player dies of acid on the very tick Zebak would spit (tick 14), so the encounter's turn runs
    // with a dead player. On the way: the partisan of the sun and the accursed sceptre refused for want
    // of 80 Attack and 70 Magic.
    name: "zebak/death-in-acid",
    kind: "zebak",
    seed: 2,
    ticks: 30,
    startHp: 20,
    stats: { ...maxedStats, attack: level(79), magic: level(69) },
    ...rangedGear,
    inventory: [KERIS_PARTISAN_OF_THE_SUN, ACCURSED_SCEPTRE],
    script(tick, api) {
      if (tick === 1) setBossHp(api, bossHp(api, 0.85)); // a Great Roar; its acid lands on tick 9
      if (tick === 2) equip(api, 0, "weapon");
      if (tick === 3) equip(api, 1, "weapon");
      // Stands in the nearest pool from tick 10: 2 + 4 + 6 + 8 damage on ticks 11 to 14.
      if (tick === 10) walkTo(api, ...nearestTile(api.player().position, (tile) => onAcid(api, tile)));
    },
  },
  {
    // The player dies of a Great Roar in the open (second pulse, tick 43), blowpipe in hand.
    name: "zebak/death-in-roar",
    kind: "zebak",
    seed: 8,
    ticks: 60,
    ...rangedGear,
    equipment: { ...rangedGear.equipment, weapon: item.toxicBlowpipe },
    supplies: { blowpipe: { ammo: { id: item.dragonDart } } },
    script(tick, api) {
      if (tick === 1) (setBossHp(api, bossHp(api, 0.85)), walkTo(api, 26, 32));
      if (tick === 4) (special(api), attack(api, ZEBAK));
    },
  },
  {
    // The raid level changed before the first tick ("other" 300 to 450, path 0 to 2, with Quiet Prayers:
    // raid level 470, 1890 hitpoints, 6-tick spits) and a fight at that level: spits prayed against let
    // a tenth through, Condemn, Tidal Waves that run their full course with nothing queued behind them,
    // and a Great Roar cut short by enrage before its rocks land.
    name: "zebak/raid-level",
    kind: "zebak",
    seed: 7,
    ticks: 110,
    mechanics: { infiniteHealth: true, quiet: true, other: "300" },
    ...magicGear,
    equipment: { ...magicGear.equipment, weapon: ACCURSED_SCEPTRE },
    script(tick, api) {
      // The engine passes a mechanics change on to the encounter only before the first tick.
      if (tick === 1) (api.mechanics({ other: "450", path: "2" }), protect(api, "ProtectMagic"));
      if (tick === 10 || tick === 16) special(api);
      if (tick === 20) setBossHp(api, bossHp(api, 0.85)); // Tidal Waves: ticks 22 to 75
      if (tick === 40) protect(api, "ProtectRange");
      if (!dodge(api) && api.player().attackTarget !== ZEBAK) attack(api, ZEBAK);
      if (tick === 84) setBossHp(api, bossHp(api, 0.7)); // a Great Roar starts on tick 86 ...
      if (tick > 84 && state(api).special === "roar") setBossHp(api, bossHp(api, 0.2)); // ... enrage on tick 87
    },
  },
  {
    // Condemn until it lands, and Tumeken's Light when the player needs all of it. The accursed sceptre's special is
    // cast again and again (the energy does not run out here). Then the player stands in a Great Roar's acid, which
    // poisons him, drinks a Saradomin brew, which lowers his levels, and with exactly 50 prayer points uses the
    // partisan of the sun: the prayer points run dry, the poison is cured and the levels are restored.
    name: "zebak/tumekens-light-in-need",
    kind: "zebak",
    seed: 2,
    ticks: 30,
    mechanics: { infiniteHealth: true, infiniteSpecialAttack: true },
    stats: { ...maxedStats, prayer: level(50) },
    equipment: { ...magicGear.equipment, weapon: ACCURSED_SCEPTRE },
    inventory: [KERIS_PARTISAN_OF_THE_SUN, item.saradominBrew],
    script(tick, api) {
      if (tick === 1) (setBossHp(api, bossHp(api, 0.85)), attack(api, ZEBAK)); // a Great Roar; its acid lands on tick 9
      if (tick < 20 && !api.player().isSpecialAttackActive) special(api);
      if (tick === 20) walkTo(api, ...nearestTile(api.player().position, (tile) => onAcid(api, tile)));
      if (tick === 24) (use(api, 1), equip(api, 0, "weapon"));
      if (tick === 26) special(api);
    },
  },
];
