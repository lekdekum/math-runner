import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    proxy: {
      "/questions": {
        target: "http://localhost:7878",
        changeOrigin: true
      },
      "/questions_csv": {
        target: "http://localhost:7878",
        changeOrigin: true
      },
      "/list-questions": {
        target: "http://localhost:7878",
        changeOrigin: true
      },
      "/submit-score": {
        target: "http://localhost:7878",
        changeOrigin: true
      },
      "/rankings": {
        target: "http://localhost:7878",
        changeOrigin: true
      }
    }
  }
});
