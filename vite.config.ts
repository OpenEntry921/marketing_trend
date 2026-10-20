import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { youtubeMiddleware } from "./server/youtube.ts";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "private-youtube-api",
      configureServer(server) {
        server.middlewares.use(youtubeMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(youtubeMiddleware);
      },
    },
  ],
  server: { host: "127.0.0.1" },
  test: { include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
});
