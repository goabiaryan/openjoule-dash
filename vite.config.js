import { defineConfig } from "vite";

export default defineConfig({
  // Root custom domain (openjoule.org); relative base keeps github.io/openjoule-dash/ working too.
  base: process.env.GITHUB_ACTIONS ? "./" : "/",
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
