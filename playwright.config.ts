import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://localhost:5373",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm --filter @workspace/outlet-validator exec vite --host 127.0.0.1 --port 5373 --strictPort",
    url: "http://127.0.0.1:5373",
    reuseExistingServer: false,
    timeout: 60_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
