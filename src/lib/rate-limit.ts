import { getCacheClient } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtEpochSec: number;
}

export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit = 120,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const cache = await getCacheClient();
  const windowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${bucket}:${identifier}:${windowBucket}`;
  const count = await cache.incr(key, windowSeconds + 5);
  const resetAtEpochSec = (windowBucket + 1) * windowSeconds;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAtEpochSec,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAtEpochSec),
  };
}
