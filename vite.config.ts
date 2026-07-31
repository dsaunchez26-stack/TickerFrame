import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // HMR's websocket can't reliably tunnel through the loca.lt/trycloudflare
    // proxy (wrong host/port gets baked into the client), which was leaving
    // the page blank for tunnel visitors while it endlessly retried. Not
    // worth fighting -- just disable it; the app still loads and works fine,
    // it just won't live-reload on new edits (a manual refresh still will).
    hmr: false,
    allowedHosts: [".trycloudflare.com", ".loca.lt"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor code (changes rarely) from app code (changes every
        // deploy) so returning visitors re-download far less on each update.
        //
        // React/react-dom/react-router used to get their own "vendor-react"
        // chunk, separate from the generic "vendor" catch-all. That created a
        // real circular chunk dependency (Rollup warned about it on every
        // build: "vendor -> vendor-react -> vendor") -- lots of small
        // node_modules packages in the generic bucket need React, but some
        // dependency of react-router itself doesn't match the special-cased
        // patterns and fell into "vendor", so each chunk ended up depending
        // on the other. That's silently fine in `vite dev` (no chunk
        // splitting happens there) but breaks in a real production build:
        // whichever chunk's module graph resolves first gets React as
        // undefined at the point it calls createContext, and the app renders
        // nothing -- confirmed by deploying to Vercel and seeing a blank
        // page with no console error, root-caused only by importing the
        // built chunk directly and catching the throw. Merging react into
        // the generic vendor bucket (rather than splitting it out) removes
        // the cycle entirely, since almost everything already depends on
        // react one-directionally.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@radix-ui")) return "vendor-radix";
          return "vendor";
        },
      },
    },
  },
}));
