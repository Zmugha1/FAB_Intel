import { defineConfig, searchForWorkspaceRoot } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

// The Hub's screens and its STZ question bank come from the pinned Hub checkout in .hub.
const hub = fileURLToPath(new URL("./.hub", import.meta.url));

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), hub] },
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
