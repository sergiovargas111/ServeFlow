import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

// Live evals call the paid Claude API, so they're kept out of `npm test` and CI.
// Run with `npm run eval:coach`. ANTHROPIC_API_KEY is read from the
// environment or .env.local (loaded the same way Next.js does).
nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    testTimeout: 15 * 60_000,
  },
});
