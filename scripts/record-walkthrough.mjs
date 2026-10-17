/**
 * Record a short tab walkthrough (Build GPU mix → Program → Scale → Operate load test).
 * Usage: node scripts/record-walkthrough.mjs
 * Requires: npx playwright install chromium
 */
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdir, rename, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../docs/demo");
const url = process.env.WALKTHROUGH_URL ?? "https://openjoule.org/#build";
/** Skip leading blank frames (Playwright records from empty page before paint). */
const trimStartSec = Number(process.env.WALKTHROUGH_TRIM_SEC ?? "1.05");

const baseName = "data-center-planner-walkthrough";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

const wait = (ms) => page.waitForTimeout(ms);

async function clickTab(name) {
  await page.locator(`[data-app-tab="${name}"]`).click();
  await wait(900);
}

async function waitForAppReady() {
  await page.locator(".app-header .brand").waitFor({ state: "visible", timeout: 60_000 });
  await page.locator('[data-view="build"].is-active').waitFor({ state: "attached" });
  await page.locator("section.isa-col[data-isa-layer='gpu']").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.fonts?.ready ?? true);
  await wait(500);
}

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForAppReady();

// Build · add second GPU to mix
const gpuCol = page.locator("section.isa-col[data-isa-layer='gpu']");
await gpuCol.scrollIntoViewIfNeeded();
await gpuCol.locator('.block-card[data-block-id="gpu-b200"]').click();
await wait(1000);

const pctA = page.locator('[data-gpu-mix-pct="gpu-h100"]');
if ((await pctA.count()) > 0) {
  await pctA.fill("55");
  await pctA.dispatchEvent("input");
  await wait(800);
}

await clickTab("program");
await wait(1200);

await clickTab("scale");
const campus = page.locator("#scale-campus-mw");
if (await campus.count()) {
  await campus.evaluate((el) => {
    el.value = "60";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(1200);
}

await clickTab("operate");
const load = page.locator(".operate-sim-slider");
await load.waitFor({ state: "visible", timeout: 15_000 });
for (const v of [15, 45, 78, 92]) {
  await load.evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  await wait(700);
}
await page.locator(".operate-sim-burst").click().catch(() => {});
await wait(1800);

await clickTab("build");
await wait(1200);

const rawVideo = await page.video()?.path();
await page.close();
await context.close();
await browser.close();

const rawPath = path.join(outDir, `${baseName}.raw.webm`);
const webmPath = path.join(outDir, `${baseName}.webm`);
const mp4Path = path.join(outDir, `${baseName}.mp4`);
const gifPath = path.join(outDir, `${baseName}.gif`);
const posterPath = path.join(outDir, `${baseName}-poster.jpg`);

if (!rawVideo) {
  console.error("No video captured");
  process.exit(1);
}
await rename(rawVideo, rawPath);

const trim = `-ss ${trimStartSec}`;
execSync(
  `ffmpeg -y ${trim} -i "${rawPath}" -c:v libvpx-vp9 -crf 32 -b:v 0 -an "${webmPath}"`,
  { stdio: "inherit" },
);
execSync(
  `ffmpeg -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${mp4Path}"`,
  { stdio: "inherit" },
);
execSync(
  `ffmpeg -y -i "${webmPath}" -filter_complex "[0:v]fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=128[p];[s1][p]paletteuse" -loop 0 "${gifPath}"`,
  { stdio: "inherit" },
);
execSync(
  `ffmpeg -y -i "${webmPath}" -frames:v 1 -update 1 -q:v 2 "${posterPath}"`,
  { stdio: "inherit" },
);

await unlink(rawPath).catch(() => {});

console.log("Wrote", webmPath, mp4Path, gifPath, posterPath);
