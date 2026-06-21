import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: proxy API + WS to the Fastify server on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: { outDir: "dist" },
});
