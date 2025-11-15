import { execSync } from "child_process";

console.log("🚀 Starting RinaWarp Backend on Render...");

try {
  console.log("📦 Running migrations...");
  execSync("npm run migrate:deploy", { stdio: "inherit" });
} catch (err) {
  console.log("⚠️ Migration failed or already applied. Continuing...");
}

console.log("🔥 Starting server...");
await import("./server.js");