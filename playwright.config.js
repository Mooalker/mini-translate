const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "python3 -m http.server 8123 --directory tests/pages",
    port: 8123,
    reuseExistingServer: true,
  },
});
