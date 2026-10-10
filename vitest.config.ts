import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        // Integration tests run real Vite builds of the fixture decks in beforeAll.
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
