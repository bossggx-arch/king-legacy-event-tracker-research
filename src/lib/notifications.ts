import type { NotificationChannel, NotificationType, WorldCode } from "@prisma/client";
import { getPrisma } from "./prisma";
import { publishRealtimeEvent } from "./realtime/sse-bus";

export interface DispatchNotificationInput {
  title: string;
  message: string;
  notificationType: NotificationType;
  worldCode?: WorldCode | null;
  categorySlug?: string | null;
  eventId?: string | null;
  serverId?: string | null;
  detectionId?: string | null;
  userId?: string | null;
  discordWebhookUrl?: string | null;
}

export async function sendDiscordWebhookEmbed(
  webhookUrl: string,
  title: string,
  description: string,
  fields: Array<{ name: string; value: string; inline?: boolean }> = []
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const parsed = new URL(webhookUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { ok: false, status: 400, error: "Invalid webhook protocol" };
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "King Legacy Global Tracker",
        embeds: [
          {
            title,
            description,
            color: 0x3b82f6,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: "King Legacy Global Event Tracker" },
          },
        ],
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "Webhook delivery failed" };
  }
}

export async function dispatchNotification(input: DispatchNotificationInput) {
  const prisma = await getPrisma();

  // Save website notification (userId null = global broadcast notification)
  const record = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      eventId: input.eventId ?? null,
      serverId: input.serverId ?? null,
      detectionId: input.detectionId ?? null,
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      worldCode: input.worldCode ?? null,
      categorySlug: input.categorySlug ?? null,
      channel: "WEBSITE" as NotificationChannel,
      deliveredAt: new Date(),
    },
  });

  publishRealtimeEvent("notification:created", {
    id: record.id,
    title: record.title,
    message: record.message,
    notificationType: record.notificationType,
    worldCode: record.worldCode,
    categorySlug: record.categorySlug,
    createdAt: record.createdAt.toISOString(),
  });

  // Deliver to configured Discord Webhook if provided or set in env
  const webhookTarget = input.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (webhookTarget && webhookTarget.startsWith("https://discord.com/api/webhooks/")) {
    const res = await sendDiscordWebhookEmbed(webhookTarget, input.title, input.message, [
      ...(input.worldCode ? [{ name: "Sea / World", value: input.worldCode, inline: true }] : []),
      ...(input.categorySlug ? [{ name: "Category", value: input.categorySlug, inline: true }] : []),
    ]);

    if (res.ok) {
      await prisma.notification.create({
        data: {
          userId: input.userId ?? null,
          eventId: input.eventId ?? null,
          serverId: input.serverId ?? null,
          detectionId: input.detectionId ?? null,
          title: input.title,
          message: input.message,
          notificationType: input.notificationType,
          worldCode: input.worldCode ?? null,
          categorySlug: input.categorySlug ?? null,
          channel: "DISCORD_WEBHOOK",
          isRead: true,
          deliveredAt: new Date(),
        },
      });
    }
  }

  return record;
}
