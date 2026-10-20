import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { instagramMiddleware } from "./server/instagram.ts";
import { youtubeMiddleware } from "./server/youtube.ts";
export default defineConfig(({ mode }) => {
  const local = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "YOUTUBE_API_KEY",
    "INSTAGRAM_ACCESS_TOKEN",
    "INSTAGRAM_USER_ID",
    "META_GRAPH_API_VERSION",
  ]) {
    if (process.env[key] === undefined && local[key])
      process.env[key] = local[key];
  }
  return {
    plugins: [
      react(),
      {
        name: "private-youtube-api",
        configureServer(server) {
          server.middlewares.use(youtubeMiddleware);
          server.middlewares.use(instagramMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(youtubeMiddleware);
          server.middlewares.use(instagramMiddleware);
        },
      },
    ],
    server: { host: "127.0.0.1" },
    test: { include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
  };
});
