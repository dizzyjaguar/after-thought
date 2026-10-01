import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths, so the built page works at a custom domain or under /after-thought/.
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  // Images come from the repo's shared assets/ folder, one level up.
  server: { port: 5174, strictPort: true, fs: { allow: [".."] } },
});
