import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "auth-password", 10);
  if (!guard.allowed) return guard.errorResponse!;

  const user = await getCurrentUser(request);
  if (!user) return jsonError("Authentication required", 401, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, changePasswordSchema);
  if (!parsed.ok) return parsed.response;

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return jsonError("Current password is incorrect", 400, undefined, guard.headers);

  const prisma = await getPrisma();
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return jsonOk({ changed: true }, 200, guard.headers);
}
