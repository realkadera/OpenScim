# The sandbox's bosses and their mechanics

Every boss of the client's fights, what it does in its own fight, and where
each mechanic is available in the sandbox (`docs/SANDBOX.md`):

- **Catalog**: the boss placed as a monster, in any arena, any number of
  times (`<encounter>/sandbox.js`, `sandbox/brawler.js`). What of its fight
  needs no room.
- **Host**: the boss of the arena, with "Fight this arena's boss with all its
  mechanics" (`sandbox/arenas.js`, `hostKind`). Its own encounter runs inside
  the sandbox: every mechanic of its fight, against the player in "versus"
  and against the nearest enemy, monster or player, in "ffa"
  (`sandbox/encounter.js`, `hostContext`, `strikeFocus`).

In both modes the mechanics act on monsters as on the player: an attack on a
monster is rolled with its stats, a hit on its tile lands on it, a heal
heals, a prayer turns hits away. Healers of a boss are what its enemies go
for first, as soon as they come (`selectTarget`, `healerOf`); the host's
boss does the same with the healers of its enemies. Every boss's gear setups
(its descriptor's `loadouts`) are among the sandbox's presets, under "Choose
gear" (`EQUIPMENT_PRESETS.sandbox`, `assets/application.js`); the Inferno
has none of its own.

`test/test-sandbox-mechanics.mjs` checks each mechanic named "tested" below;
every host fights a monster in a free-for-all there and in the determinism
harness (`sandbox/host-ffa/<arena>`).

| Boss | Its fight's mechanics | Catalog | Host (arena) |
|---|---|---|---|
| Sol Heredit | spear and shield ground attacks; triple attack; grapple; phases with light beams, crystals, molten sand; enrage; modifiers | ground attack (spear or shield, tiles from where he and his target stand, no prayer stops it), tested | all, Sol Heredit's arena |
| Yama | melee and magic/ranged; fireballs; shadow waves; glyphs; void flares that heal him as they explode; contracts | his attacks; no projectile drawn | all, Yama's room; void flares targeted first, checked |
| Zebak | bite, magic and ranged spits; roar; waves; jugs; boulders; acid; enrage below a quarter | immobile, faces east; bite, spits, enrage (NPC 11732); his tail as a second body | all, Zebak's room |
| Vardorvis | slashes; axes from the tendrils; bleed; head gaze below 570 (prayer drain); darts and spikes; heals half of what he deals | heals half of what he deals, on the player and on monsters, tested | all, Vardorvis' clearing (woken at the start in "ffa") |
| Doom of Mokhaiotl | tongue; orbs of three styles; rock throws; melee charge and beam; larvae that heal him; shockwaves and volatile earth; demonic shield (delve 3+); burrows (delve 5+) | his orbs | all, both rooms; larvae targeted first, checked |
| JalTok-Jad | magic and ranged with a 3-tick windup; melee; five healers below half | windup, both styles at random, melee every 4 ticks; five healers below half that heal him 10 every 4 ticks until hit, targeted first, tested | — (no Inferno host) |
| TzKal-Zuk | his shield; Jad and healers; set-piece waves | immobile; calls Jad (with healers) below 40 % and four healers below 20 % that heal 15 to 24 and throw sparks, tested | — |
| The Leviathan | orb volleys of three styles; roar and falling rocks; bite beside the pool; shadow stun; lightning and smoke specials; enrage and pathfinder | immobile; orbs (every third melee), bite beside it | all, the Leviathan's Scar |
| Duke Sucellus | icicles and slam beside him; magic cluster; Freezing Gaze behind pillars; gas at the vents; enrage | immobile; slam beside him, magic, faster enraged | all, Duke's asylum (woken at the start in "ffa") |
| Araxxor | legs, magic, ranged; specials (acid drip, spray, ball); eggs that hatch Mirrorback, Acidic, Ruptura; acid pools; enrage with cleave | walks; three attacks; enrage below a quarter; an araxyte every 42 ticks (acidic, mirrorback, ruptura); Mirrorback throws back half of a melee hit; Ruptura blows up beside its target, tested | all, Araxxor's lair |
| The Maggot King | spits (far), head slams (near); screech that hurts praying players; bile; carrion; larvae that leech and heal him | far spits, comes in below two thirds and slams; every sixth attack a screech that hurts a praying player or a monster with an overhead; below 85 % a larva that leeches and heals him, targeted first, tested | all, the Maggot King's lair; larvae targeted first, tested |
| The Corrupted Hunllef | four attacks a style then a switch; protection prayer switched by six hits of another style; tornadoes; the floor's tiles | rotation, prayer (from the player, monsters and the host's boss alike), tornadoes that hurt its enemies, tested | all, the Corrupted Hunllef's room |
| The Alchemical Hydra | three attacks a style; four forms by hitpoints; shield lifted by the right vent; poison pools, lightning, fire specials; enrage | walks; three a style with the heads' sway; electric, flame and enraged forms below each quarter, with their max hits and speed, tested | all, the Hydra's chamber; its shield takes three quarters off a monster's hit too |
| Phosani's Nightmare | magic, ranged, melee; shield then four totems to charge; blasts; sleepwalkers; specials (claws, husks, parasites that heal her shield, curse, spores, flowers, surge); desperation | walks; magic, ranged, melee; her forms by her hitpoints | all, Phosani's dream; monsters break her shield, charge her totems and beat her, tested; parasites targeted first |

What a monster of the catalog leaves out is named in its `sandbox.js`: what
needs its room (rocks, vents, floors, eggs, acid, bile, carrion, totems).
Those come with the host only.

## What changed for this list

- The Alchemical Hydra and Phosani's Nightmare are in the catalog
  (`alchemical-hydra/sandbox.js`, `phosanis-nightmare/sandbox.js`) and their
  rooms are arenas with their host.
- A catalog monster may take forms by its hitpoints (`forms`), and every
  scene of the sandbox draws the new form (before, Zebak enraged, Araxxor
  enraged and the Hunllef's prayer forms kept their first look in the
  default scene).
- Healers are targeted first as they come: the Maggot King's larvae (they
  were never targeted before), and the host's healers.
- The host's fight goes on while its boss cannot be attacked (before, the
  Nightmare's blast froze the host in a free-for-all with no player).
- A monster blocked by the room goes round it (before #137's straight walk
  held it behind any wall or tree); a boulder still holds it.
