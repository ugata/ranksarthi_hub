import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      server: { entry: "server" },
    }),
    ...(command === "build"
      ? [
          nitro({
            // Defaults to a plain Node.js server (VM/container deploys).
            // Set NITRO_PRESET=cloudflare-module to build for Cloudflare Workers instead.
            preset: process.env["NITRO_PRESET"] ?? "node-server",
            output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
            ...(process.env["NITRO_PRESET"] === "cloudflare-module"
              ? { cloudflare: { nodeCompat: true, deployConfig: true } }
              : {}),
          }),
        ]
      : []),
    viteReact(),
  ],
  server: { host: "::", port: 8080, strictPort: true, hmr: { overlay: false } },
}));
