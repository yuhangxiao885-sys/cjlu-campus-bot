import { readFileSync } from "node:fs";

const probe = process.argv.includes("--probe");
const logIndex = process.argv.indexOf("--log");
const logPath = logIndex > -1 ? process.argv[logIndex + 1] : "";
const deadline = probe ? 0 : Date.now() + 120_000;
let logUrl = "";
let logUrlSeenAt = 0;
let announcedFromLog = false;

const readLogUrl = () => {
  if (!logPath) return "";
  try {
    const text = readFileSync(logPath, "utf8");
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    return match ? match[0] : "";
  } catch {
    return "";
  }
};

for (;;) {
  for (let port = 20240; port <= 20260; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/metrics`, {
        signal: AbortSignal.timeout(1200),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const active = text.match(/^cloudflared_tunnel_ha_connections (\d+)/m);
      const host = text.match(
        /userHostname="(https:\/\/[^"]+trycloudflare\.com)"/,
      );
      if (host && active && Number(active[1]) > 0) {
        console.log(host[1]);
        process.exit(0);
      }
    } catch {
      // port not serving metrics
    }
  }

  if (!probe) {
    const fresh = readLogUrl();
    if (fresh && fresh !== logUrl) {
      logUrl = fresh;
      logUrlSeenAt = Date.now();
    }
    if (logUrl && Date.now() - logUrlSeenAt > 20_000 && !announcedFromLog) {
      announcedFromLog = true;
      console.log(logUrl);
      process.exit(0);
    }
    if (Date.now() > deadline) {
      if (logUrl) {
        console.log(logUrl);
        process.exit(0);
      }
      break;
    }
  } else if (Date.now() > deadline) {
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

process.exit(1);
