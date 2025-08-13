import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Anti-ellipsis corruption check plugin (runs on buildStart)
function antiEllipsisPlugin() {
  const roots = ["src", "supabase/functions", "supabase/migrations"];
  const exts = /(\.tsx?|\.jsx?|\.sql|\.md|\.json|\.yml|\.yaml)$/i;
  const PLACEHOLDER_LINE = /^\s*(?:\.{3}|…)(?:\s.*)?$/m;
  const IN_WORD = /[A-Za-z0-9_](?:\.{3}|…)[A-Za-z0-9_]/;

  return {
    name: "anti-ellipsis-check",
    apply: "build",
    buildStart() {
      const bad: string[] = [];
      const ignore = new Set(["node_modules", "dist", "build", ".next", "coverage", ".vercel", ".output"]);
      const walk = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            if (!ignore.has(name)) walk(full);
            continue;
          }
          if (!exts.test(name)) continue;
          const txt = fs.readFileSync(full, "utf8");
          if (!txt.includes("...") && !txt.includes("…")) continue;
          const hasPlaceholder = PLACEHOLDER_LINE.test(txt);
          const hasInWord = IN_WORD.test(txt);
          if (hasPlaceholder || hasInWord) bad.push(full);
        }
      };
      roots.filter((r) => fs.existsSync(r)).forEach(walk);
      if (bad.length) {
        throw new Error(`Ellipsis corruption found in:\n${bad.join("\n")}`);
      }
    },
  } as const;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    antiEllipsisPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}));
