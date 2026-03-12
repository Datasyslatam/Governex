#!/usr/bin/env node

const { spawnSync } = require("child_process");
const { platform } = require("os");
const path = require("path");

// Ensure vite binary is executable on Unix systems
if (platform() !== "win32") {
  try {
    spawnSync("chmod", ["+x", path.join(__dirname, "..", "node_modules", ".bin", "vite")], {
      stdio: "inherit"
    });
  } catch (err) {
    // ignore
  }
}

// Run Vite build via Node to avoid relying on shell executable permissions
const vitePath = path.join(__dirname, "..", "node_modules", "vite", "bin", "vite.js");
const res = spawnSync(process.execPath, [vitePath, "build"], { stdio: "inherit" });
process.exit(res.status);
