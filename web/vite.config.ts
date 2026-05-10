import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Dev server proxy only (Compose sets `http://api:8080`). */
const apiProxyTarget =
  process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});

