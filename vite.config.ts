import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Unique ID stamped into every build — used for stale-deployment detection.
const BUILD_ID = Date.now().toString();

// Emits /version.json into the dist folder so the running app can fetch it
// and compare against its own BUILD_ID to detect when a new deploy is live.
function versionPlugin(): Plugin {
  return {
    name: 'emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID }),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), versionPlugin()],
    define: {
      // GEMINI_API_KEY must NOT be bundled here — call Gemini via a server-side
      // proxy (Supabase Edge Function / Vercel serverless) so the key is never
      // shipped to the client.
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      minify: 'esbuild',
    },
    esbuild: {
      // Strip all console.* calls and debugger statements from production builds
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
