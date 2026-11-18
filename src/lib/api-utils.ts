import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "./rate-limit";
import { ensureBackgroundScannerStarted } from "./scanner/queue";
import { getCalibratedServerNowMs } from "./time-sync";

export function jsonOk<T>(
  data: T,
  status = 200,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "X-Server-Time": String(getCalibratedServerNowMs()),
      ...extraHeaders,
    },
  });
}

export function jsonError(
  message: string,
  status = 400,
  details?: unknown,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(
    {
      error: message,
      details: details ?? undefined,
      serverTimeMs: Date.now(),
    },
    { status, headers: extraHeaders }
  );
}

export async function applyApiGuard(
  request: Request,
  bucket = "api-v1",
  limit = 180,
  windowSeconds = 60
): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
  errorResponse?: NextResponse;
}> {
  void ensureBackgroundScannerStarted();
  const apiKey = request.headers.get("x-api-key") || "";
  const id = apiKey ? `key:${apiKey.slice(0, 14)}` : `ip:${getClientIp(request)}`;
  const rl = await checkRateLimit(id, bucket, limit, windowSeconds);
  const headers = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return {
      allowed: false,
      headers,
      errorResponse: jsonError(
        "Rate limit exceeded. Please slow down requests.",
        429,
        { limit: rl.limit, resetAtEpochSec: rl.resetAtEpochSec },
        headers
      ),
    };
  }
  return { allowed: true, headers };
}

export async function parseValidatedBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const raw = await request.json();
    const data = schema.parse(raw);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        response: jsonError("Validation error", 400, err.flatten()),
      };
    }
    return {
      ok: false,
      response: jsonError("Invalid JSON request body", 400),
    };
  }
}

export function parsePagination(searchParams: URLSearchParams, defaultLimit = 50, maxLimit = 200) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const rawLimit = Number.parseInt(searchParams.get("limit") || String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
