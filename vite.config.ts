import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173, // Vite default port
    proxy: {
      "/api": {
        target: "http://localhost:8080", // Backend API
        changeOrigin: true,
        secure: false,
      },
    },
  },

  plugins: [
    react(),   // Removed lovable-tagger (Cloudflare incompatible)
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
