import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    proxy: {
      "/api": {
        target: "https://sparkvibe.app",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    proxy: {
      "/api": {
        target: "https://sparkvibe.app",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  },
  plugins: [react()],
  envDir: '.',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    assetsDir: "assets",
  },
  optimizeDeps: {
    exclude: ["lucide-react"]
  }
});