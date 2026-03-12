import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: "src",
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
    },
    setupFiles: ["__tests__/helpers/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
