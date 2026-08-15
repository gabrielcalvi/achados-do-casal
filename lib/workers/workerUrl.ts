const RAILWAY_WORKER_URL =
  "https://heroic-benevolence-production-1ccf.up.railway.app";

export const WORKER_URL = (
  process.env.PLAYWRIGHT_WORKER_URL?.trim() ||
  (process.env.VERCEL ? RAILWAY_WORKER_URL : "http://127.0.0.1:4317")
).replace(/\/$/, "");
