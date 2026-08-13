/**
 * Dev launcher — picks the first free port starting at 3000, then starts
 * `next dev` on it AND tells the app which origin it's running on
 * (via NEXT_PUBLIC_SITE_URL, read by siteConfig.ts). So even if 3000 is busy
 * and the app falls back to e.g. 3005, canonical/OG/sitemap URLs are correct.
 *
 * Run: npm run dev
 */
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const START_PORT = Number(process.env.PORT ?? 3000);
const MAX_TRIES = 30;

function findFreePort(start, maxTries) {
  return new Promise((resolve, reject) => {
    const attempt = (offset) => {
      if (offset > maxTries) {
        return reject(new Error(`No free port found between ${start} and ${start + maxTries}`));
      }
      const port = start + offset;
      const srv = createServer();
      srv.unref();
      srv.on("error", () => attempt(offset + 1));
      // No host arg → binds to "::" (dual-stack), matching how `next dev` listens.
      srv.listen(port, () => {
        srv.close(() => resolve(port));
      });
    };
    attempt(0);
  });
}

const port = await findFreePort(START_PORT, MAX_TRIES);
const origin = `http://localhost:${port}`;

const prefersColor = process.stdout.isTTY;
const accent = prefersColor ? "\x1b[36m" : "";
const bold = prefersColor ? "\x1b[1m" : "";
const reset = prefersColor ? "\x1b[0m" : "";

if (port !== START_PORT) {
  console.log(
    `${accent}ℹ${reset} Port ${START_PORT} is busy — using ${bold}${port}${reset} instead.`,
  );
}
console.log(`${accent}🚀${reset} Starting dev server on ${bold}${origin}${reset}\n`);

const child = spawn("npx", ["next", "dev", "-p", String(port)], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_PUBLIC_SITE_URL: origin,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
