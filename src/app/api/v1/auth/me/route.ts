import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { getCurrentUser, sanitizeUser } from "@/lib/auth";

const updateProfileSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  discordWebhookUrl: z.string().url().nullable().optional().or(z.literal("")),
  notifyWorlds: z.array(z.enum(["FIRST_SEA", "SECOND_SEA", "THIRD_SEA"])).optional(),
  notifyCategories: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "auth-me");
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  return jsonOk({ user: user ? sanitizeUser(user) : null }, 200, guard.headers);
}

export async function PUT(request: Request) {
  const guard = await applyApiGuard(request, "auth-me-update", 30);
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  if (!user) return jsonError("Authentication required", 401, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, updateProfileSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      username: parsed.data.username ?? user.username,
      discordWebhookUrl:
        parsed.data.discordWebhookUrl === "" ? null : parsed.data.discordWebhookUrl ?? user.discordWebhookUrl,
      notifyWorlds: parsed.data.notifyWorlds ?? user.notifyWorlds,
      notifyCategories: parsed.data.notifyCategories ?? user.notifyCategories,
    },
  });

  return jsonOk({ user: sanitizeUser(updated) }, 200, guard.headers);
}
