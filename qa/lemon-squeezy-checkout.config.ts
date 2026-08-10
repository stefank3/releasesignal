import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(__dirname, "lemon-squeezy-checkout"),
  outputDir: path.join(__dirname, "test-results", "lemon-squeezy-checkout"),
  retries: 0,
  workers: 1,
  projects: [{ name: "lemon-squeezy-checkout" }],
});
