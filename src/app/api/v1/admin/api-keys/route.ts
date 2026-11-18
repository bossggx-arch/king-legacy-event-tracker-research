import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { generateRawApiKey, getCurrentUser } from "@/lib/auth";

const createKeySchema = z.object({
  name: z.string().min(2).max(80),
  rateLimitPerMin: z.number().int().min(10).max(5000).default(120),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "api-keys-list");
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  if (!user) return jsonError("Authentication required", 401, undefined, guard.headers);

  const prisma = await getPrisma();
  const keys = await prisma.apiKey.findMany({
    where: user.role === "ADMIN" ? undefined : { userId: user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimitPerMin: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      user: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ data: keys }, 200, guard.headers);
}

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "api-keys-create", 20);
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  if (!user) return jsonError("Authentication required", 401, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, createKeySchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const { rawKey, keyPrefix, keyHash } = generateRawApiKey();

  const created = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyPrefix,
      keyHash,
      userId: user.id,
      rateLimitPerMin: parsed.data.rateLimitPerMin,
      scopes:
        user.role === "ADMIN"
          ? ["read:events", "read:servers", "read:scanner", "write:reports", "admin:all"]
          : ["read:events", "read:servers", "read:scanner", "write:reports"],
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: user.id,
      adminUsername: user.username,
      action: "CREATE_API_KEY",
      targetType: "ApiKey",
      targetId: created.id,
      detailsJson: JSON.stringify({ name: created.name, keyPrefix }),
    },
  });

  return jsonOk(
    {
      data: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        rawKey,
        createdAt: created.createdAt,
      },
    },
    201,
    guard.headers
  );
}

export async function DELETE(request: Request) {
  const guard = await applyApiGuard(request, "api-keys-delete", 20);
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  if (!user) return jsonError("Authentication required", 401, undefined, guard.headers);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("API Key id required", 400);

  const prisma = await getPrisma();
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) return jsonError("API Key not found", 404);
  if (user.role !== "ADMIN" && existing.userId !== user.id) {
    return jsonError("Forbidden", 403);
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return jsonOk({ revoked: true, id }, 200, guard.headers);
}
