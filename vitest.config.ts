import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Priority coverage per TEST-CHECKLIST.md Gate 2: the scoring engines and the
      // conditional-logic evaluator land under lib/scoring and lib/questionnaire in later
      // phases. Nothing to include yet — Phase 0 only proves the harness runs.
      include: ["lib/**/*.ts"],
      exclude: ["lib/db/**", "lib/**/*.d.ts"],
    },
  },
});
