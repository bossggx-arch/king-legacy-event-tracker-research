import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node ./node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000",
    url: "http://127.0.0.1:3000/api/v1/health",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
