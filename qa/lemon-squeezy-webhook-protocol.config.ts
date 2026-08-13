import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: path.join(__dirname, "lemon-squeezy-webhook-protocol"),
  outputDir: path.join(__dirname, "test-results", "lemon-squeezy-webhook-protocol"),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  projects: [{ name: "protocol" }],
});
