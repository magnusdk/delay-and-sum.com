import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [preact(), glsl()],
  server: { host: true },
});
