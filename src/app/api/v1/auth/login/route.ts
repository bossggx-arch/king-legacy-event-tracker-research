import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { attachSessionCookie, sanitizeUser, signSessionToken, verifyPassword } from "@/lib/auth";

const loginSchema = z.object({
  emailOrUsername: z.string().min(2).max(120),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  // Brute force protection: max 20 login attempts per minute per IP
  const guard = await applyApiGuard(request, "auth-login", 20, 60);
  if (!guard.allowed) return guard.errorResponse!;

  const parsed = await parseValidatedBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const identifier = parsed.data.emailOrUsername.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
    },
  });

  if (!user) {
    return jsonError("Invalid credentials", 401, undefined, guard.headers);
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return jsonError("Invalid credentials", 401, undefined, guard.headers);
  }

  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
  const response = jsonOk({ user: sanitizeUser(user) }, 200, guard.headers);
  attachSessionCookie(response, token);
  return response;
}
