import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "notifications-list");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const user = await getCurrentUser(request);

  const notifications = await prisma.notification.findMany({
    where: user ? { OR: [{ userId: null }, { userId: user.id }] } : { userId: null },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return jsonOk(
    {
      data: notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}

export async function PATCH(request: Request) {
  const guard = await applyApiGuard(request, "notifications-read");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;

  if (id) {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }

  return jsonOk({ updated: true }, 200, guard.headers);
}
