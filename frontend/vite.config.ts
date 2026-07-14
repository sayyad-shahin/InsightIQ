import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the FastAPI backend in dev so there are no CORS issues.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  // `vite preview` (production bundle) uses a separate proxy config; mirror the
  // dev proxy so a prod-preview build can also reach the local backend.
  preview: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2020",
    // Plotly is inherently large but is route-split and lazy-loaded (charts only),
    // so it never blocks the initial load of landing/auth/dashboard shells.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("plotly.js")) return "plotly";
          if (id.includes("react-markdown") || id.includes("rehype") || id.includes("remark") || id.includes("hast") || id.includes("mdast") || id.includes("micromark")) return "markdown";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("node_modules/react") || id.includes("react-router") || id.includes("react-dom")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
