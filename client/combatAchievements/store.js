// The player's combat achievements, kept in this browser (localStorage): the
// tasks completed, when, the clean kills of each boss, every fight of each boss
// that ended (`fights`: { kills, deaths } by kind, the kills that did not count
// among them), the tasks chosen to go for at each (the setup's list:
// `selected`, task ids by kind), and the settings. There are no
// accounts, so another browser starts from nothing. Storage that is missing
// or refuses (a private window, blocked site data) leaves the progress in
// memory for the visit.
const storageKey = "openscim.combatAchievements.v1";

// The settings, the game's two of failures (WIKI: Settings, Chat, Game Chat): `failureMessages`,
// "Combat Achievements Tasks - Failure", a line in the chat as a task fails; `repeatFailureMessages`,
// "Combat Achievements Tasks - Repeat failure", the same for a task completed before. inferred: the
// wiki gives no defaults; the first is on, as it was asked for, the second off. And this application's own,
// `showRecord`: the boss's kills, deaths and their ratio in the header of its setup (on).
export const defaultSettings = { failureMessages: true, repeatFailureMessages: false, showRecord: true };

const empty = () => ({ completed: {}, kills: {}, fights: {}, selected: {}, settings: { ...defaultSettings } });

function read(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "null");
    if (parsed && typeof parsed === "object")
      return {
        completed: { ...parsed.completed },
        kills: { ...parsed.kills },
        fights: { ...parsed.fights },
        selected: { ...parsed.selected },
        settings: { ...defaultSettings, ...parsed.settings },
      };
  } catch {
    // unreadable: start again
  }
  return empty();
}

/** A store over `storage` (window.localStorage in the client). */
export function createCombatAchievementsStore(storage = globalThis.localStorage) {
  let state = read(storage);
  const listeners = new Set();
  const save = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(state));
    } catch {
      // kept in memory only
    }
    for (const listener of [...listeners]) listener(state);
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    completedKeys: () => new Set(Object.keys(state.completed)),
    /** Counts a clean kill of `kind`; the kills it has now. */
    recordKill(kind) {
      state = { ...state, kills: { ...state.kills, [kind]: (state.kills[kind] ?? 0) + 1 } };
      save();
      return state.kills[kind];
    },
    complete(keys) {
      const at = new Date().toISOString();
      state = { ...state, completed: { ...state.completed, ...Object.fromEntries(keys.map((key) => [key, at])) } };
      save();
    },
    /** Counts a fight of `kind` that ended: "kill" or "death". */
    recordFight(kind, ended) {
      const seen = state.fights[kind] ?? { kills: 0, deaths: 0 };
      const next = ended === "kill" ? { ...seen, kills: seen.kills + 1 } : { ...seen, deaths: seen.deaths + 1 };
      state = { ...state, fights: { ...state.fights, [kind]: next } };
      save();
    },
    /** Every fight of `kind` that ended: { kills, deaths }. */
    fightsOf: (kind) => state.fights[kind] ?? { kills: 0, deaths: 0 },
    /** The ids of the tasks chosen to go for at `kind`. */
    selectedFor: (kind) => state.selected[kind] ?? [],
    /** Chooses the tasks to go for at `kind` (their ids). */
    setSelected(kind, ids) {
      state = { ...state, selected: { ...state.selected, [kind]: [...new Set(ids)] } };
      save();
    },
    setSetting(key, value) {
      state = { ...state, settings: { ...state.settings, [key]: value } };
      save();
    },
    /** Forgets everything but the settings and the chosen tasks, or one boss's completed tasks, kills and fights. */
    reset(kind) {
      state = kind
        ? {
            completed: Object.fromEntries(Object.entries(state.completed).filter(([key]) => !key.startsWith(kind + ":"))),
            kills: Object.fromEntries(Object.entries(state.kills).filter(([key]) => key !== kind)),
            fights: Object.fromEntries(Object.entries(state.fights).filter(([key]) => key !== kind)),
            selected: state.selected,
            settings: state.settings,
          }
        : { ...empty(), selected: state.selected, settings: state.settings };
      save();
    },
  };
}
