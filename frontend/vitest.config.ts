import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  resolve: { alias: [{ find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" }] },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./vitest.setup.ts"] },
});
