import { chromium } from "playwright-core";
import { browserOptions } from "./browser.mjs";
const browser = await chromium.launch(browserOptions);
try {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    const start = performance.now();
    await page.goto("http://127.0.0.1:5173/yama/");
    await page.waitForFunction(() => {
      const text = document.querySelector("#root")?.innerText;
      return text?.includes("Practice") && !text.includes("Did you know?");
    });
    times.push(Math.round(performance.now() - start));
    await page.close();
  }
  console.log(JSON.stringify(times));
} finally {
  await browser.close();
}
