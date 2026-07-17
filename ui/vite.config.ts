import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Simule __dirname dans un module ESM :
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
const apiPort = process.env.API_PORT;
if (!apiPort) {
  throw new Error(
    "API_PORT is required. Use: API_PORT=8080 npm run dev  (miner-api)  or  API_PORT=8081 npm run dev  (remote-api)",
  );
}

export default defineConfig({
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
});
