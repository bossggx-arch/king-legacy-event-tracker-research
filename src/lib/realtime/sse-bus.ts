import { EventEmitter } from "node:events";
import { getCalibratedServerNowMs } from "../time-sync";

export type RealtimeEventTopic =
  | "event:detected"
  | "event:updated"
  | "event:expired"
  | "server:discovered"
  | "server:updated"
  | "server:closed"
  | "report:created"
  | "report:reviewed"
  | "notification:created"
  | "scanner:status"
  | "heartbeat";

export interface RealtimeMessage {
  topic: RealtimeEventTopic;
  timestamp: string;
  serverTimeMs: number;
  payload: Record<string, unknown>;
}

const globalForSse = globalThis as unknown as {
  __klSseBus?: EventEmitter;
};

function getEmitter(): EventEmitter {
  if (!globalForSse.__klSseBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalForSse.__klSseBus = emitter;
  }
  return globalForSse.__klSseBus;
}

export function publishRealtimeEvent(topic: RealtimeEventTopic, payload: Record<string, unknown>) {
  const now = getCalibratedServerNowMs();
  const msg: RealtimeMessage = {
    topic,
    timestamp: new Date(now).toISOString(),
    serverTimeMs: now,
    payload,
  };
  getEmitter().emit("message", msg);
}

export function subscribeRealtimeEvents(listener: (msg: RealtimeMessage) => void): () => void {
  const emitter = getEmitter();
  emitter.on("message", listener);
  return () => {
    emitter.off("message", listener);
  };
}
