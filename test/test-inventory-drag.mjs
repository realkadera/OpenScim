// The inventory's drag rules against the numbers of the game's clientscripts
// 6007, 6010 and 6013 and of the client's drag routine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import {
  DRAG_DEAD_TIME_MS,
  dragPosition,
  isDragStarted,
  slotAt,
  slotPosition,
} from "../client/assets/inventoryDrag.js";

test("slots are 36 by 32 at 16 + column * 42, 8 + row * 36", () => {
  assert.deepEqual(slotPosition(0), { x: 16, y: 8 });
  assert.deepEqual(slotPosition(27), { x: 142, y: 224 });
  assert.equal(slotAt(16, 8), 0);
  assert.equal(slotAt(51, 39), 0);
  assert.equal(slotAt(58, 8), 1);
  assert.equal(slotAt(177, 255), 27);
});

test("the gaps between slots and the border are no drop target", () => {
  assert.equal(slotAt(52, 8), null);
  assert.equal(slotAt(16, 40), null);
  assert.equal(slotAt(15, 8), null);
  assert.equal(slotAt(178, 255), null);
  assert.equal(slotAt(177, 256), null);
});

test("a drag needs the dead time and more than 5px on one axis", () => {
  const press = { x: 30, y: 20 };
  const held = DRAG_DEAD_TIME_MS;
  assert.equal(isDragStarted(0, press, { x: 36, y: 20 }, held), true);
  assert.equal(isDragStarted(0, press, { x: 30, y: 14 }, held), true);
  assert.equal(isDragStarted(0, press, { x: 35, y: 25 }, held), false);
  assert.equal(isDragStarted(0, press, { x: 90, y: 90 }, held - 1), false);
  assert.equal(isDragStarted(0, press, { x: 36, y: 20 }, 299, 300), false);
});

test("the held slot keeps its grab offset and stays in the inventory", () => {
  const press = { x: 30, y: 20 };
  assert.deepEqual(dragPosition(0, press, { x: 80, y: 60 }), { x: 66, y: 48 });
  assert.deepEqual(dragPosition(0, press, { x: -500, y: -500 }), { x: 0, y: 0 });
  assert.deepEqual(dragPosition(0, press, { x: 900, y: 900 }), { x: 154, y: 229 });
  // Pulled against the bottom edge the slot can only come down 5px: no drag.
  assert.equal(isDragStarted(27, { x: 150, y: 230 }, { x: 150, y: 400 }, DRAG_DEAD_TIME_MS), false);
});

// The same rules through the real panel, with Anti Drag off as it is by
// default: a hold of 400ms is well past the dead time, one of 30ms well short.
test("the inventory panel drags as the client does", async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(process.env.TEST_ORIGIN + "/zebak/");
    await page.waitForSelector('button[aria-label^="Item "]');
    await page.waitForTimeout(1500);
    const read = () =>
      page.evaluate(() => {
        const panel = document.querySelector('button[aria-label^="Item "]').parentElement;
        const origin = panel.getBoundingClientRect();
        const ghost = [...panel.children].find((child) => child.tagName === "DIV" && child.style.zIndex === "100");
        return {
          slots: [...panel.querySelectorAll(":scope > button")].map((button) => {
            const box = button.getBoundingClientRect();
            return { item: button.getAttribute("aria-label"), x: box.left, y: box.top, opacity: button.style.opacity };
          }),
          ghost: ghost && {
            x: ghost.getBoundingClientRect().left - origin.left,
            y: ghost.getBoundingClientRect().top - origin.top,
            opacity: ghost.style.opacity,
          },
        };
      });
    const items = async () => (await read()).slots.map((slot) => slot.item);
    const { slots } = await read();
    const before = slots.map((slot) => slot.item);
    assert.notEqual(before[0], before[1]);
    const hold = async (fromX, fromY, toX, toY, ms) => {
      await page.mouse.move(slots[0].x + fromX, slots[0].y + fromY);
      await page.mouse.down();
      await page.mouse.move(slots[0].x + toX, slots[0].y + toY);
      await page.waitForTimeout(ms);
    };

    // Moved at once and then held still: the drag starts on the delay alone.
    // The item keeps its grab offset (5, 5), is half transparent, and has left
    // its slot. Slot 1 is 42px right of slot 0, the cursor is at (20, 20) in it.
    await hold(5, 5, 62, 20, 400);
    const held = await read();
    assert.deepEqual(held.ghost, { x: 23 + 42 + 15, y: 15 + 15, opacity: "0.5" });
    assert.equal(held.slots[0].opacity, "0");
    await page.mouse.up();
    await page.waitForTimeout(1300);
    let swapped = await items();
    assert.deepEqual(swapped.slice(0, 2), [before[1], before[0]]);

    // Released in the gap between slot 0 and slot 1: no swap and no click.
    await hold(5, 5, 38, 5, 400);
    await page.mouse.up();
    await page.waitForTimeout(1300);
    assert.deepEqual(await items(), swapped);

    // Released over its own slot after a drag: no click either.
    await hold(5, 5, 15, 5, 400);
    await page.mouse.up();
    await page.waitForTimeout(1300);
    assert.deepEqual(await items(), swapped);

    // The same movement released before the delay is a click: the item is worn.
    await hold(5, 5, 15, 5, 30);
    await page.mouse.up();
    await page.waitForFunction(
      (item) => document.querySelector('button[aria-label^="Item "]').parentElement.querySelector(":scope > button").getAttribute("aria-label") !== item,
      swapped[0],
    );
  } finally {
    await browser.close();
  }
});
