const { test: base, chromium, expect } = require("@playwright/test");
const path = require("path");

// Extension root = parent of tests/
const EXT_PATH = path.join(__dirname, "..");

// Custom fixture: each test gets a fresh persistent context with the
// extension loaded. Extensions require a persistent context and headed
// mode (or new headless via channel:chromium).
const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");
    const id = sw.url().split("/")[2];
    await use(id);
  },
});

module.exports = { test, expect };
