import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(__dirname);

const isDev = process.argv.includes("--dev");
const skipBrowser = process.argv.includes("--no-open");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const url = `http://localhost:${port}`;
const healthUrl = `http://127.0.0.1:${port}/api/v1/health`;

function openBrowser(targetUrl) {
  if (skipBrowser) return;
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", targetUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
  }
}

async function isServerHealthy() {
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("====================================================");
  console.log("  KING LEGACY GLOBAL EVENT TRACKER - LAUNCHER");
  console.log("====================================================");
  console.log(`Workspace: ${__dirname}`);
  console.log(`Mode: ${isDev ? "Development" : "Production"} | URL: ${url}`);
  console.log("");

  // If already running, just open the browser cleanly
  if (await isServerHealthy()) {
    console.log(`[Launcher] Server is already running at ${url}`);
    console.log("[Launcher] Opening browser...");
    openBrowser(url);
    return;
  }

  // Ensure dependencies exist
  const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(nextBin)) {
    console.log("[Launcher] node_modules not found. Installing dependencies...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const installRes = spawnSync(npmCmd, ["install"], {
      cwd: __dirname,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (installRes.status !== 0) {
      console.error("[Launcher] npm install failed.");
      process.exit(1);
    }
  }

  // Ensure production build exists in production mode
  const buildIdPath = path.join(__dirname, ".next", "BUILD_ID");
  if (!isDev && !fs.existsSync(buildIdPath)) {
    console.log("[Launcher] Production build not found. Building Next.js app...");
    const buildRes = spawnSync(process.execPath, [nextBin, "build"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    if (buildRes.status !== 0) {
      console.error("[Launcher] Build failed.");
      process.exit(1);
    }
  }

  const args = isDev
    ? [nextBin, "dev", "--turbopack", "-p", String(port)]
    : [nextBin, "start", "-H", "0.0.0.0", "-p", String(port)];

  console.log("[Launcher] Starting King Legacy Global Event Tracker server...");
  const child = spawn(process.execPath, args, {
    cwd: __dirname,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    console.log(`[Launcher] Server exited with code ${code ?? 0}`);
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });

  // Poll /api/v1/health and open browser once server is ready
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    if (await isServerHealthy()) {
      console.log("");
      console.log(`[Launcher] Ready! Opening ${url} in your browser...`);
      console.log("[Launcher] Keep this window open while using the tracker.");
      openBrowser(url);
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((err) => {
  console.error("[Launcher] Fatal error:", err);
  process.exit(1);
});
