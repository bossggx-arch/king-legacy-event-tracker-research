import { subscribeRealtimeEvents } from "@/lib/realtime/sse-bus";
import { ensureBackgroundScannerStarted } from "@/lib/scanner/queue";
import { getCalibratedServerNowMs } from "@/lib/time-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  void ensureBackgroundScannerStarted();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Initial server time synchronization frame
      const initNow = getCalibratedServerNowMs();
      send("connected", {
        serverTimeMs: initNow,
        timestamp: new Date(initNow).toISOString(),
        message: "Connected to King Legacy Global Event Stream",
      });

      const unsubscribe = subscribeRealtimeEvents((msg) => {
        send(msg.topic, msg);
      });

      const heartbeat = setInterval(() => {
        const beatNow = getCalibratedServerNowMs();
        send("heartbeat", {
          topic: "heartbeat",
          serverTimeMs: beatNow,
          timestamp: new Date(beatNow).toISOString(),
        });
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore already closed stream
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
