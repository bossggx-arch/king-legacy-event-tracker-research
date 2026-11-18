const globalForTimeSync = globalThis as unknown as {
  __klNetworkOffsetMs?: number;
  __klLastSyncAtMs?: number;
};

/**
 * Tracks network clock skew against Roblox's official HTTP Date header.
 * Returns Date.now() calibrated with the observed network offset (clamped safely).
 */
export function recordNetworkDateHeader(httpDateHeader: string | null | undefined, receivedAtMs = Date.now()) {
  if (!httpDateHeader) return;
  const parsedMs = Date.parse(httpDateHeader);
  if (Number.isNaN(parsedMs)) return;

  // HTTP Date headers have 1-second resolution; only adjust if skew exceeds 2 seconds
  const rawDiff = parsedMs + 500 - receivedAtMs;
  if (Math.abs(rawDiff) > 2000 && Math.abs(rawDiff) < 24 * 60 * 60 * 1000) {
    globalForTimeSync.__klNetworkOffsetMs = rawDiff;
  } else if (Math.abs(rawDiff) <= 2000) {
    globalForTimeSync.__klNetworkOffsetMs = 0;
  }
  globalForTimeSync.__klLastSyncAtMs = receivedAtMs;
}

export function getNetworkTimeOffsetMs(): number {
  return globalForTimeSync.__klNetworkOffsetMs ?? 0;
}

export function getCalibratedServerNowMs(): number {
  return Date.now() + getNetworkTimeOffsetMs();
}

export async function refreshNetworkTimeFromRoblox(): Promise<number> {
  const lastSync = globalForTimeSync.__klLastSyncAtMs ?? 0;
  if (Date.now() - lastSync < 60_000) {
    return getCalibratedServerNowMs();
  }
  try {
    const t0 = Date.now();
    const res = await fetch("https://games.roblox.com/v1/games?universeIds=1451439645", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    const t1 = Date.now();
    const midpoint = Math.round((t0 + t1) / 2);
    recordNetworkDateHeader(res.headers.get("date"), midpoint);
  } catch {
    // Keep existing offset if offline
  }
  return getCalibratedServerNowMs();
}
