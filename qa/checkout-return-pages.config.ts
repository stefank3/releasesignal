import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(__dirname, "checkout-return-pages"),
  outputDir: path.join(__dirname, "test-results", "checkout-return-pages"),
  retries: 0,
  workers: 1,
  projects: [{ name: "checkout-return-pages" }],
});
