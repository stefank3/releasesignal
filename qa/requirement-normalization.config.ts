import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(__dirname, "requirement-normalization"),
  outputDir: path.join(__dirname, "test-results", "requirement-normalization"),
  retries: 0,
  use: {
    headless: true,
  },
  projects: [
    {
      name: "requirement-normalization",
    },
  ],
});
