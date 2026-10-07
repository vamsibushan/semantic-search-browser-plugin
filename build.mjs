// Cross-browser build: bundles src/popup.ts and emits dist/<chrome|firefox>/.
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2] ?? "chrome";
if (target !== "chrome" && target !== "firefox") {
  console.error(`Unknown target: ${target} (expected "chrome" or "firefox")`);
  process.exit(1);
}

const outdir = `dist/${target}`;
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: { background: "src/background.ts", popup: "src/popup.ts" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outdir,
  define: { "process.env.NODE_ENV": '"production"' },
});

cpSync("src/popup.html", `${outdir}/popup.html`);
cpSync("src/icons", `${outdir}/icons`, { recursive: true });

const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8"));
if (target === "firefox") {
  // Firefox MV3 does not support background.service_worker — it uses an
  // event page instead, which needs a classic (non-module) script.
  manifest.background = { scripts: ["background.js"] };
  await build({
    entryPoints: { background: "src/background.ts" },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: `${outdir}/background.js`,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  // Required for unsigned local development installs in Firefox.
  manifest.browser_specific_settings = {
    gecko: {
      id: "semantic-tab-finder@example.com",
      strict_min_version: "121.0",
    },
  };
}
writeFileSync(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Built ${target} -> ${outdir}/`);
