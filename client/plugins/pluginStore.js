// The state of a plugin that keeps its own settings: whether it is on, and
// its options. Attack Ranges (attackRanges.js) is kept with the
// application's settings (Grid.js), which takes edits to the bundles at each
// step; a plugin made with this store is listed in the Plugins panel by one
// entry (application.js, PluginStoreEntry), and what it draws reads the store
// itself (rendering.js). Kept in localStorage under "openscim.plugin.<key>";
// where there is none (Node: the determinism harness), only in memory.
//
// options: [{ key, label, section, type: "boolean" | "select" | "number" |
// "color" ("AARRGGBB") | "hotkey" | "text", default, info, choices?, min?,
// max? }], as attackRanges.js lists its own.
export function createPluginStore(key, options, { enabledByDefault = false } = {}) {
  const defaults = Object.fromEntries(options.map((option) => [option.key, option.default]));
  const storageKey = "openscim.plugin." + key;
  const valid = (option, value) => {
    switch (option.type) {
      case "boolean":
        return typeof value === "boolean";
      case "select":
        return option.choices.some((choice) => choice.value === value);
      case "number":
        return Number.isInteger(value) && value >= option.min && value <= option.max;
      case "color":
        return typeof value === "string" && /^[0-9A-F]{8}$/i.test(value);
      default:
        return typeof value === "string";
    }
  };
  const read = (saved) => {
    const settings = typeof saved === "object" && saved !== null ? saved : {};
    return Object.fromEntries(options.map((option) => [option.key, valid(option, settings[option.key]) ? settings[option.key] : option.default]));
  };
  let state = { enabled: enabledByDefault, settings: { ...defaults } };
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? "null");
    if (saved) state = { enabled: typeof saved.enabled === "boolean" ? saved.enabled : enabledByDefault, settings: read(saved.settings) };
  } catch {
    // Nothing kept, or not readable: the defaults.
  }
  const listeners = new Set();
  const set = (next) => {
    state = next;
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Not kept; still applied.
    }
    for (const listener of listeners) listener();
  };
  return {
    key,
    options,
    defaults,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setEnabled: (enabled) => set({ ...state, enabled }),
    setSettings: (settings) => set({ ...state, settings: read(settings) }),
  };
}

// "AARRGGBB" as "#RRGGBB".
export const toHexColor = (argb) => "#" + argb.slice(2).toUpperCase();
