// How the tests and the tools start a browser: chromium.launch(browserOptions).
//
// With CHROME_PATH unset, Playwright starts its own headless shell
// (npx playwright-core install chromium-headless-shell), not the Chrome that is installed.
// On Windows every start of Chrome with a new profile, and Playwright gives each a new one,
// fails one logon of the user's account (Security log, event 4625). Windows 11 locks an
// account after 10 of them in 10 minutes, and one run of the tests is more than that. The
// headless shell makes none.
//
// --enable-gpu: without it the shell draws in software, the tests take three times as long,
// and the application shows its notice about hardware acceleration over the page.
// --enable-unsafe-swiftshader: WebGL all the same on a machine without a GPU.
export const browserPath = process.env.CHROME_PATH || undefined;
export const browserOptions = { executablePath: browserPath, args: ["--enable-gpu", "--enable-unsafe-swiftshader"] };
