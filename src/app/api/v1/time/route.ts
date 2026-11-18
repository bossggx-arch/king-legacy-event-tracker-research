import { NextResponse } from "next/server";
import {
  getCalibratedServerNowMs,
  getNetworkTimeOffsetMs,
  refreshNetworkTimeFromRoblox,
} from "@/lib/time-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const calibratedNowMs = await refreshNetworkTimeFromRoblox();
  const d = new Date(calibratedNowMs);

  return NextResponse.json(
    {
      serverTimeMs: calibratedNowMs,
      systemTimeMs: Date.now(),
      networkOffsetMs: getNetworkTimeOffsetMs(),
      isoUtc: d.toISOString(),
      bangkokTime: d.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Bangkok",
        hour12: false,
      }),
      timezone: "Asia/Bangkok",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Server-Time": String(calibratedNowMs),
      },
    }
  );
}
