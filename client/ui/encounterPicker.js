// The encounter picker: the window the lobby's book, the menu and the quick
// search open to choose a fight. On the left every encounter as a tile, in
// the sections of encounters/catalog.js; on the right the chosen one, with
// its modes and one button to fight it.
//
// It is a React component written without JSX, because nothing compiles the
// modules. application.js renders it from a few lines of its own (`Spe`),
// which keep what lives in the bundle: the stack of windows Escape closes,
// the click outside the card, and the lookups it hands over as props.
//
//   overlayProps, cardProps, cardRef   what the bundle's windows put on their
//                                      backdrop and card
//   onClose()
//   onEnter(kind)                      start the fight with its saved setup
//   onConfigure(kind, name, subtitle)  open the setup window of a fight
//   onTutorialMode(kind)               optional; start the kind's tutorial
//   currentEncounterKind               the encounter being played, or null
//   initialSelection                   { kind, variantId? } to open on, or null
//   encounterRegistry                  encounters/registry.js
//   getPresentation(kind), hasTutorial(kind)
//   variantIcons                       { [variant id]: image URL }
//   portraitTools                      { createView, npcModelLoader,
//                                      animationSystem }, what portraits.js
//                                      draws a boss with; null until loaded
//   issuesLink                         the element that links where issues are reported
//   lobbyKind                          the kind "Return to Lobby" enters
//   hiddenKinds                        kinds that are no fight to set up
import React from "react";
import { encounterDefinitions } from "../engine/encounterKinds.js";
import { encounterCatalog, encounterCategories } from "../encounters/catalog.js";
import { drawPortrait } from "./portraits.js";
import { buildEncounterEntries, groupEncounters, groupVariants, searchEncounters } from "./encounterCatalog.js";

const { createElement: h, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

// Colours, borders and fonts are the application's own, so a UI pack that
// restyles the application restyles this window with it.
const styles = `
.ep-overlay { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 24px;
  font: 16px/20px "RuneScape Bold 12", sans-serif; }
.ep-overlay, .ep-overlay * { box-sizing: border-box; }
.ep-backdrop { position: absolute; inset: 0; background: var(--modal-backdrop, #080604b8); }
.ep { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: 1180px; max-width: 100%; height: 780px; max-height: 100%;
  color: var(--color-text-body, #cec0a3); background: var(--color-bg-solid, #1e1812); border: 1px solid var(--modal-card-border, #383023);
  border-radius: var(--modal-radius, 2px); box-shadow: var(--modal-card-shadow, none); overflow: hidden; }
.ep button { font: inherit; color: inherit; cursor: pointer; }
.ep-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 16px 56px 12px 20px; background: var(--color-surface, #14100c);
  border-bottom: 1px solid var(--color-border, #383023); }
.ep-head h2 { margin: 0; color: var(--color-heading, #ddc9a3); font: 24px/28px "RuneScape Bold 12", sans-serif; }
.ep-search { flex: 1 1 220px; max-width: 340px; height: 36px; padding: 0 12px; color: var(--color-heading, #ddc9a3); background: var(--color-surface-inset, #0a0805);
  border: 1px solid var(--color-primary-structure, #5d5245); border-radius: 2px; font: 16px/20px "RuneScape Plain 12", "RuneScape Bold 12", sans-serif; outline: none; }
.ep-search:focus { border-color: var(--color-primary, #c39a52); }
.ep-search::placeholder { color: var(--color-text-muted, #948366); }
.ep-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ep-chip { height: 28px; padding: 0 10px; color: var(--color-text-muted, #948366); background: none; border: 1px solid var(--color-border, #383023); border-radius: 2px; }
.ep-chip:hover { color: var(--color-heading, #ddc9a3); border-color: var(--color-primary-structure, #5d5245); }
.ep-chip.active { color: var(--color-heading, #ddc9a3); background: var(--color-surface-inset, #0a0805); border-color: var(--color-primary, #c39a52); }
.ep-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; background: none; border: 1px solid transparent; border-radius: 2px;
  font: 22px/1 sans-serif; color: var(--color-text-muted, #948366); }
.ep-close:hover { color: var(--color-heading, #ddc9a3); border-color: var(--color-border, #383023); }
.ep-body { display: grid; grid-template-columns: minmax(0, 1fr) 400px; min-height: 0; }
.ep-list { min-height: 0; padding: 4px 20px 20px; overflow-y: auto; overscroll-behavior: contain; }
.ep-section { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 8px; color: var(--color-accent-text, #d6b26c); }
.ep-section small { color: var(--color-text-dim, #5b4f40); font: 16px/20px "RuneScape Plain 11", sans-serif; }
.ep-section::after { content: ""; flex: 1; height: 1px; background: var(--color-border, #383023); }
.ep-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 8px; }
.ep-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 132px; padding: 10px 6px 8px; text-align: center;
  background: var(--color-surface, #14100c); border: 1px solid var(--color-border, #383023); border-radius: 2px; }
.ep-tile:hover { background: var(--color-surface-hover, #363229); }
.ep-tile.active { background: var(--color-surface-inset, #0a0805); border-color: var(--color-primary, #c39a52); box-shadow: inset 0 0 0 1px var(--color-primary, #c39a52); }
.ep-tile.soon { opacity: 0.55; }
.ep-tile-name { color: var(--color-heading, #ddc9a3); line-height: 18px; overflow-wrap: anywhere; }
.ep-tile-sub { color: var(--color-text-muted, #948366); font: 16px/16px "RuneScape Plain 11", sans-serif; }
.ep-art { display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; flex: none; overflow: hidden; image-rendering: pixelated; }
.ep-art img { width: 100%; height: 100%; object-fit: contain; }
.ep-art.cover img { object-fit: cover; }
.ep-art.drawn, .ep-art.letter { background: #0a0805; border: 1px solid var(--color-primary-structure, #5d5245); border-radius: 2px; }
.ep-art.drawn { image-rendering: auto; }
.ep-art.letter { color: var(--color-primary, #c39a52); font: 32px/1 "RuneScape Bold 12", sans-serif; }
.ep-tag { padding: 0 5px; color: var(--color-warning, #dc8f44); border: 1px solid currentColor; border-radius: 2px; font: 16px/16px "RuneScape Plain 11", sans-serif; }
.ep-tag.soon { color: var(--color-text-muted, #948366); }
.ep-tile .ep-tag { position: absolute; top: 6px; right: 6px; background: var(--color-bg-solid, #1e1812); }
.ep-empty { padding: 48px 16px; text-align: center; color: var(--color-text-muted, #948366); }
.ep-detail { display: flex; flex-direction: column; min-height: 0; background: var(--color-bg-elevated, #241d16); border-left: 1px solid var(--color-border, #383023); }
.ep-detail-scroll { flex: 1; min-height: 0; padding: 20px; overflow-y: auto; overscroll-behavior: contain; }
.ep-back { display: none; margin-bottom: 12px; padding: 4px 10px; background: none; border: 1px solid var(--color-border, #383023); border-radius: 2px; }
.ep-hero { display: flex; align-items: center; gap: 16px; }
.ep-hero .ep-art { width: 112px; height: 112px; }
.ep-hero .ep-art.letter { font-size: 52px; }
.ep-hero h1 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 4px; color: var(--color-heading, #ddc9a3);
  font: 32px/34px "RuneScape Bold 12", sans-serif; }
.ep-tagline { color: var(--color-text-muted, #948366); font: 16px/18px "RuneScape Plain 11", sans-serif; }
.ep-text { margin: 16px 0 0; line-height: 20px; font-family: "RuneScape Plain 12", "RuneScape Bold 12", sans-serif; }
.ep-label { margin: 20px 0 6px; color: var(--color-accent-text, #d6b26c); }
.ep-group { margin: 10px 0 4px; color: var(--color-text-muted, #948366); font: 16px/18px "RuneScape Plain 11", sans-serif; }
.ep-mode { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 4px; padding: 8px 10px; text-align: left; background: var(--color-surface, #14100c);
  border: 1px solid var(--color-border, #383023); border-radius: 2px; }
.ep-mode:hover { background: var(--color-surface-hover, #363229); }
.ep-mode.active { background: var(--color-surface-inset, #0a0805); border-color: var(--color-primary, #c39a52); }
.ep-mode.soon { opacity: 0.55; cursor: default; }
.ep-mode img { width: 32px; height: 32px; flex: none; object-fit: contain; image-rendering: pixelated; }
.ep-mode-dot { width: 12px; height: 12px; flex: none; border: 1px solid var(--color-primary-structure, #5d5245); border-radius: 50%; }
.ep-mode.active .ep-mode-dot { background: var(--color-primary, #c39a52); border-color: var(--color-primary, #c39a52); }
.ep-mode-text { flex: 1; min-width: 0; }
.ep-mode-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--color-heading, #ddc9a3); }
.ep-mode-sub { display: block; color: var(--color-text-muted, #948366); font: 16px/18px "RuneScape Plain 11", sans-serif; }
.ep-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--color-border, #383023); }
.ep-actions .ep-fight { flex: 1 1 160px; min-height: 44px; font-size: 20px; }
.ep-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 20px; color: var(--color-text-dim, #5b4f40);
  background: var(--color-surface, #14100c); border-top: 1px solid var(--color-border, #383023); font: 16px/18px "RuneScape Plain 11", sans-serif; }
.ep-foot .osrs-btn { font-family: "RuneScape Bold 12", sans-serif; }
@media (max-width: 760px) {
  .ep-overlay { padding: 0; }
  .ep { width: 100%; height: 100%; border: 0; }
  .ep-head { padding: 12px 52px 10px 12px; }
  .ep-search { max-width: none; }
  .ep-body { grid-template-columns: minmax(0, 1fr); }
  .ep-list { padding: 0 12px 12px; }
  .ep-tiles { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  .ep-detail { display: none; position: absolute; inset: 0; z-index: 2; border: 0; }
  .ep.detail-open .ep-detail { display: flex; }
  .ep-back { display: inline-block; }
  .ep-keys { display: none; }
}
`;

// The picture of an encounter: its own, else its boss drawn from the game
// cache (portraits.js), and its first letter until that is drawn or when
// there is nothing to draw.
function Art({ entry, portraitTools }) {
  const { thumb, thumbFit, heroArt, portrait } = entry.presentation;
  const picture = thumb ?? heroArt;
  const [drawing, setDrawing] = useState(null);
  useEffect(() => {
    if (picture || !portrait || !portraitTools) return;
    let current = true;
    drawPortrait(portraitTools, portrait).then((url) => current && setDrawing(url));
    return () => {
      current = false;
    };
  }, [picture, portrait, portraitTools]);
  if (picture) return h("span", { className: "ep-art" + (thumbFit === "cover" ? " cover" : "") }, h("img", { crossOrigin: "anonymous", src: picture, alt: "" }));
  if (drawing) return h("span", { className: "ep-art drawn" }, h("img", { src: drawing, alt: "" }));
  return h("span", { className: "ep-art letter", "aria-hidden": "true" }, entry.title.replace(/^the\s+/i, "").charAt(0).toUpperCase());
}

function statusTag(status) {
  if (status === "beta") return h("span", { className: "ep-tag" }, "BETA");
  if (status === "soon") return h("span", { className: "ep-tag soon" }, "Soon");
  return null;
}

// The tile to move to from `current` in a direction, by where the tiles are
// drawn: the grid has as many columns as fit, and its sections break rows.
function neighbourTile(tiles, current, key) {
  const index = tiles.indexOf(current);
  if (index === -1) return tiles[0];
  if (key === "ArrowLeft") return tiles[index - 1];
  if (key === "ArrowRight") return tiles[index + 1];
  const from = current.getBoundingClientRect();
  const down = key === "ArrowDown";
  let best, bestRow = Infinity, bestAcross = Infinity;
  for (const tile of tiles) {
    const to = tile.getBoundingClientRect();
    const row = down ? to.top - from.top : from.top - to.top;
    if (row < 1) continue;
    const across = Math.abs(to.left - from.left);
    if (row < bestRow - 1 || (Math.abs(row - bestRow) <= 1 && across < bestAcross)) {
      best = tile;
      bestRow = row;
      bestAcross = across;
    }
  }
  return best;
}

export function EncounterPicker({
  overlayProps,
  cardProps,
  cardRef,
  onClose,
  onEnter,
  onConfigure,
  onTutorialMode,
  currentEncounterKind = null,
  initialSelection = null,
  encounterRegistry,
  getPresentation,
  hasTutorial,
  variantIcons = {},
  portraitTools = null,
  issuesLink = "the issues tab on GitHub",
  lobbyKind = "lobby",
  hiddenKinds = [],
}) {
  const entries = useMemo(
    () =>
      buildEncounterEntries({
        descriptors: encounterRegistry.getRegisteredKinds().map((kind) => encounterRegistry.getDescriptor(kind)),
        kinds: encounterDefinitions,
        catalog: encounterCatalog,
        getPresentation,
        hasTutorial,
        hiddenKinds: [lobbyKind, ...hiddenKinds],
      }),
    [encounterRegistry],
  );

  // What the window opens on: the fight that was asked for, else the one
  // being played, else the first that can be fought.
  const [opening] = useState(() => {
    const playing = currentEncounterKind ? (encounterRegistry.getDescriptorOfKindOrVariant(currentEncounterKind)?.kind ?? currentEncounterKind) : null;
    const asked = initialSelection && entries.find((entry) => entry.kind === initialSelection.kind && entry.available);
    const entry = asked ?? entries.find((candidate) => candidate.kind === playing && candidate.available) ?? entries.find((candidate) => candidate.available) ?? entries[0];
    const variantId = asked ? initialSelection.variantId : entry?.variants.find((variant) => variant.encounterKind === currentEncounterKind)?.id;
    return { kind: entry?.kind ?? null, variantId };
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedKind, setSelectedKind] = useState(opening.kind);
  // The chosen mode of each encounter looked at, by kind.
  const [chosenVariants, setChosenVariants] = useState(() => (opening.variantId ? { [opening.kind]: opening.variantId } : {}));
  const [detailOpen, setDetailOpen] = useState(false);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const found = useMemo(() => searchEncounters(entries, query, encounterCategories), [entries, query]);
  const shown = found.filter(({ entry }) => category === "all" || entry.category === category).map(({ entry }) => entry);
  const searching = query.trim() !== "";
  const sections = searching ? [{ id: "results", label: "Results", entries: shown }].filter((section) => section.entries.length > 0) : groupEncounters(shown, encounterCategories);
  const usedCategories = encounterCategories.filter(({ id }) => entries.some((entry) => entry.category === id));

  const selected = shown.find((entry) => entry.kind === selectedKind) ?? sections[0]?.entries[0] ?? null;
  const variants = selected?.variants ?? [];
  const variant = variants.find((candidate) => candidate.id === chosenVariants[selected?.kind]) ?? variants.find((candidate) => candidate.available !== false) ?? variants[0] ?? null;
  const canFight = !!selected?.available && !!variant && variant.available !== false;

  const select = (kind, variantId) => {
    setSelectedKind(kind);
    if (variantId !== undefined) setChosenVariants((chosen) => ({ ...chosen, [kind]: variantId }));
  };
  const fight = () => {
    if (!canFight) return;
    onEnter(variant.encounterKind);
    onClose();
  };
  const setUp = () => {
    if (!canFight) return;
    onConfigure(variant.encounterKind, variant.name, variant.subtitle);
    onClose();
  };

  // The search box has the keyboard from the first key: at once, and again
  // after whatever opened the window has let go of the focus.
  useLayoutEffect(() => {
    searchRef.current?.focus();
    const timer = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);
  // A search opens on what it found best, and on the mode it named.
  useEffect(() => {
    if (!searching || found.length === 0) return;
    const first = found.find(({ entry }) => category === "all" || entry.category === category);
    if (first) select(first.entry.kind, first.variantId);
  }, [query, category]);
  useLayoutEffect(() => {
    listRef.current?.querySelector(".ep-tile.active")?.scrollIntoView?.({ block: "nearest" });
  }, [selected?.kind]);

  // The search box keeps the keyboard: the arrows walk the tiles (left and
  // right only while nothing is typed, where they would move the caret).
  const onKeyDown = (event) => {
    const arrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
    if (arrow && !((event.key === "ArrowLeft" || event.key === "ArrowRight") && query !== "")) {
      const tiles = [...(listRef.current?.querySelectorAll(".ep-tile") ?? [])];
      const next = neighbourTile(tiles, tiles.find((tile) => tile.dataset.kind === selected?.kind), event.key);
      event.preventDefault();
      if (next) select(next.dataset.kind);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) setUp();
      else fight();
    }
  };

  const tile = (entry) =>
    h(
      "button",
      {
        key: entry.kind,
        type: "button",
        tabIndex: -1,
        "data-kind": entry.kind,
        "aria-pressed": entry.kind === selected?.kind,
        className: "ep-tile" + (entry.kind === selected?.kind ? " active" : "") + (entry.available ? "" : " soon"),
        // The search box keeps the focus, and with it the keyboard.
        onMouseDown: (event) => event.preventDefault(),
        onClick: () => {
          select(entry.kind);
          setDetailOpen(true);
        },
        onDoubleClick: () => entry.kind === selected?.kind && fight(),
      },
      h(Art, { entry, portraitTools }),
      h("span", { className: "ep-tile-name" }, entry.title),
      entry.variants.length > 1 && h("span", { className: "ep-tile-sub" }, entry.variants.length + " " + entry.variantLabel.toLowerCase() + "s"),
      statusTag(entry.status),
    );

  const mode = (candidate) =>
    h(
      "button",
      {
        key: candidate.id,
        type: "button",
        "aria-pressed": candidate.id === variant?.id,
        disabled: candidate.available === false,
        className: "ep-mode" + (candidate.id === variant?.id ? " active" : "") + (candidate.available === false ? " soon" : ""),
        onClick: () => select(selected.kind, candidate.id),
        onDoubleClick: fight,
      },
      variantIcons[candidate.id] ? h("img", { src: variantIcons[candidate.id], alt: "" }) : h("span", { className: "ep-mode-dot" }),
      h(
        "span",
        { className: "ep-mode-text" },
        h("span", { className: "ep-mode-name" }, candidate.name, candidate.isWorkInProgress && statusTag("beta"), candidate.available === false && statusTag("soon")),
        candidate.subtitle && h("span", { className: "ep-mode-sub" }, candidate.subtitle),
      ),
    );

  const detail =
    selected &&
    h(
      "section",
      { className: "ep-detail", "aria-label": selected.title },
      h(
        "div",
        { className: "ep-detail-scroll" },
        h("button", { type: "button", className: "ep-back", onClick: () => setDetailOpen(false) }, "< Back"),
        h(
          "div",
          { className: "ep-hero" },
          h(Art, { key: selected.kind, entry: selected, portraitTools }),
          h("div", null, h("h1", null, selected.title, statusTag(selected.status)), selected.tagline && h("div", { className: "ep-tagline" }, selected.tagline)),
        ),
        (selected.description || selected.status === "beta") &&
          h(
            "p",
            { className: "ep-text" },
            selected.description,
            selected.status === "beta" && [" Please report any issues you notice to ", h(React.Fragment, { key: "link" }, issuesLink), "."],
          ),
        variants.length > 1 && h("div", { className: "ep-label" }, selected.variantLabel),
        variants.length > 1 &&
          groupVariants(variants).map(({ group, variants: grouped }) =>
            h("div", { key: group ?? "ungrouped" }, group && h("div", { className: "ep-group" }, group), grouped.map(mode)),
          ),
      ),
      h(
        "div",
        { className: "ep-actions" },
        canFight
          ? [
              h("button", { key: "fight", type: "button", className: "osrs-btn osrs-btn--primary ep-fight", onClick: fight }, "Fight"),
              h("button", { key: "setup", type: "button", className: "osrs-btn osrs-btn--default", onClick: setUp }, "Edit setup"),
              selected.hasTutorial &&
                onTutorialMode &&
                h(
                  "button",
                  {
                    key: "tutorial",
                    type: "button",
                    className: "osrs-btn osrs-btn--ghost",
                    onClick: () => {
                      onTutorialMode(selected.kind);
                      onClose();
                    },
                  },
                  "Start Tutorial",
                ),
            ]
          : h("span", { className: "ep-tagline" }, "Coming soon. This fight cannot be played yet."),
      ),
    );

  return h(
    "div",
    { className: "ep-overlay", ...overlayProps },
    h("style", null, styles),
    h("div", { className: "ep-backdrop" }),
    h(
      "div",
      {
        className: "ep centered-modal-snap" + (detailOpen ? " detail-open" : ""),
        ...cardProps,
        ref: cardRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Encounters",
      },
      h(
        "header",
        { className: "ep-head" },
        h("h2", null, "Encounters"),
        h("input", {
          ref: searchRef,
          className: "ep-search",
          type: "text",
          "aria-label": "Search encounters",
          placeholder: "Search encounters...",
          value: query,
          onChange: (event) => setQuery(event.target.value),
          onKeyDown,
        }),
        usedCategories.length > 1 &&
          h(
            "div",
            { className: "ep-chips", role: "group", "aria-label": "Category" },
            [{ id: "all", label: "All" }, ...usedCategories].map(({ id, label }) =>
              h(
                "button",
                {
                  key: id,
                  type: "button",
                  "aria-pressed": id === category,
                  className: "ep-chip" + (id === category ? " active" : ""),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => setCategory(id),
                },
                label,
              ),
            ),
          ),
        h("button", { type: "button", className: "ep-close", "aria-label": "Close", onClick: onClose }, "×"),
      ),
      h(
        "div",
        { className: "ep-body" },
        h(
          "div",
          { className: "ep-list", ref: listRef },
          sections.length === 0 && h("div", { className: "ep-empty" }, searching ? `No encounters match "${query.trim()}".` : "No encounters found."),
          sections.map((section) =>
            h(
              React.Fragment,
              { key: section.id },
              h("div", { className: "ep-section" }, section.label, h("small", null, section.entries.length)),
              h("div", { className: "ep-tiles" }, section.entries.map(tile)),
            ),
          ),
        ),
        detail,
      ),
      h(
        "footer",
        { className: "ep-foot" },
        encounterRegistry.isRegistered(lobbyKind)
          ? h(
              "button",
              {
                type: "button",
                className: "osrs-btn osrs-btn--ghost",
                onClick: () => {
                  onEnter(lobbyKind);
                  onClose();
                },
              },
              "Return to Lobby",
            )
          : h("span"),
        h("span", { className: "ep-keys" }, "Arrows: browse · Enter: fight · Shift+Enter: edit setup · Esc: close"),
      ),
    ),
  );
}
