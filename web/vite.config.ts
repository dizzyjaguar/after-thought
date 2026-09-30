/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths so the native app can serve the build from its bundle.
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
  // The editor needs a DOM; happy-dom is a fast stand-in for the browser.
  test: { environment: "happy-dom" },
});
