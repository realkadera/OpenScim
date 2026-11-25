// The Plugins panel holds the fight while it is open (application.js,
// modalPaused). This says so over the scene, so that a click on the boss or on
// a tile that does nothing has its reason on screen: a label for as long as the
// fight is held, and a pulse of the label and of the panel's close button when
// the scene is clicked. The label is a button: it closes the panel.
// No game number is here; the sizes and times are this interface's own.

const STYLE_ID = "plugins-paused-hint-style";
const PULSE_CLASS = "plugins-paused-pulse";
const STAGE = ".game-viewport-stage";
const PANEL = ".plugins-overlay";

// The panel is 320px wide on the right (application.css, .plugins-overlay);
// where it covers the whole page (narrow screens) the scene cannot be clicked
// and the label would lie under it.
const css = `
.plugins-paused-hint {
  position: absolute;
  top: 64px;
  left: calc((100% - 320px) / 2);
  transform: translateX(-50%);
  z-index: 60;
  padding: 6px 12px;
  border: 1px solid var(--color-border, #5a5248);
  border-radius: 4px;
  background: var(--color-bg-solid, #1e1b17);
  color: var(--color-text, #f0e6d2);
  font: 16px "RuneScape Bold 12", sans-serif;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 12px #000a;
}
.plugins-paused-hint:hover { border-color: var(--color-primary, #ffb000); }
.plugins-paused-hint.${PULSE_CLASS},
${PANEL} .panel-close-button.${PULSE_CLASS} {
  animation: plugins-paused-pulse 0.3s ease-in-out 3;
}
@keyframes plugins-paused-pulse {
  50% {
    border-color: var(--color-primary, #ffb000);
    color: var(--color-primary, #ffb000);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #ffb000) 60%, transparent);
  }
}
@media (max-width: 700px) { .plugins-paused-hint { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .plugins-paused-hint.${PULSE_CLASS},
  ${PANEL} .panel-close-button.${PULSE_CLASS} {
    animation: none;
    border-color: var(--color-primary, #ffb000);
    color: var(--color-primary, #ffb000);
  }
}`;

/** Starts the pulse again from its first frame, also when one is still running. */
function pulse(element) {
  if (!element) return;
  element.classList.remove(PULSE_CLASS);
  void element.offsetWidth;
  element.classList.add(PULSE_CLASS);
}

/**
 * Shows the label over the scene and listens for clicks on the scene; returns
 * the function that removes both. `onClose` closes the Plugins panel.
 */
export function showPluginsPausedHint(onClose, doc = globalThis.document) {
  const stage = doc?.querySelector(STAGE);
  if (!stage) return () => {};
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    doc.head.append(style);
  }
  const label = doc.createElement("button");
  label.type = "button";
  label.className = "plugins-paused-hint";
  label.textContent = "Paused – close Plugins to resume";
  label.addEventListener("click", () => onClose?.());
  stage.append(label);

  const closeButton = () => doc.querySelector(`${PANEL} .panel-close-button`);
  // The main button only: the others turn the camera, which still works.
  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target === label || !stage.contains(event.target)) return;
    pulse(label);
    pulse(closeButton());
  };
  doc.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    label.remove();
    closeButton()?.classList.remove(PULSE_CLASS);
  };
}
