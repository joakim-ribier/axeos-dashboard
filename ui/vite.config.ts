import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Simule __dirname dans un module ESM :
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
// API_PORT only matters for the dev server's /api proxy target -- a
// production build (`vite build`) is just static files, served by nginx
// with its own real reverse proxy (see DEPLOYMENT.md), so it has no use
// for it and shouldn't require it either.
export default defineConfig(({ command }) => {
  const apiPort = process.env.API_PORT;
  if (command === "serve" && !apiPort) {
    throw new Error(
      "API_PORT is required. Use: API_PORT=8080 npm run dev  (miner-api)  or  API_PORT=8081 npm run dev  (remote-api)",
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
