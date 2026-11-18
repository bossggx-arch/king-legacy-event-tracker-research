import { z } from "zod";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { sendDiscordWebhookEmbed } from "@/lib/notifications";

const webhookSchema = z.object({
  webhookUrl: z.string().url(),
});

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "notifications-webhook", 10);
  if (!guard.allowed) return guard.errorResponse!;

  const parsed = await parseValidatedBody(request, webhookSchema);
  if (!parsed.ok) return parsed.response;

  const result = await sendDiscordWebhookEmbed(
    parsed.data.webhookUrl,
    "King Legacy Tracker — Webhook Test",
    "Your Discord Webhook notification channel is connected to King Legacy Global Event Tracker!",
    [
      { name: "Universe ID", value: "1451439645", inline: true },
      { name: "Status", value: "CONNECTED", inline: true },
    ]
  );

  if (!result.ok) {
    return jsonError(
      result.error || `Discord returned HTTP ${result.status}`,
      400,
      undefined,
      guard.headers
    );
  }

  return jsonOk({ delivered: true, status: result.status }, 200, guard.headers);
}
