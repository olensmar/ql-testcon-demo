import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "results/junit.xml" }], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    // A trace for every test (passing too), saved as test-results/<test>/trace.zip and in the HTML report.
    trace: "on",
    screenshot: "only-on-failure",
  },
});
