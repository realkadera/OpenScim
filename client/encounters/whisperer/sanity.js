// The Whisperer's overlay over the game view: the sanity bar (interface 834 in the game, CACHE), and the darkness of
// the Shadow Realm while the player is in it. The game draws the Shadow Realm as a map of its own (WIKI); here the
// same arena is darkened instead, keeping its colours: the light and dark seeds are told apart by theirs.
let shown = null; // { element, fill, label, tint, viewport }

function open() {
  const viewport = document.querySelector(".scene-viewport");
  if (!viewport) return null;
  const element = document.createElement("div");
  element.className = "whisperer-overlay";
  element.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
  const tint = document.createElement("div");
  tint.className = "whisperer-overlay__shadow";
  tint.style.cssText = "position:absolute;inset:0;background:rgba(20,8,32,0.35);opacity:0;transition:opacity 0.3s;";
  const bar = document.createElement("div");
  bar.className = "whisperer-overlay__sanity";
  bar.style.cssText = "position:absolute;left:12px;top:48px;width:160px;height:18px;border:1px solid #000;background:#3a1a1a;font:12px RuneScape Small,sans-serif;color:#fff;text-shadow:1px 1px #000;";
  const fill = document.createElement("div");
  fill.style.cssText = "position:absolute;left:0;top:0;bottom:0;background:#4f8fbf;";
  const label = document.createElement("div");
  label.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;";
  bar.append(fill, label);
  element.append(tint, bar);
  viewport.append(element);
  return { element, fill, label, tint, viewport };
}

/** Brings the overlay in step with the fight, every frame: `{ sanity, shadow }`, or null for none. */
export function syncSanity(fight) {
  if (!fight) {
    shown?.element.remove();
    shown = null;
    return;
  }
  if (shown && !shown.element.isConnected) shown = null;
  shown ??= open();
  if (!shown) return;
  shown.fill.style.width = fight.sanity + "%";
  shown.label.textContent = "Sanity: " + fight.sanity + "%";
  shown.tint.style.opacity = fight.shadow ? "1" : "0";
}
