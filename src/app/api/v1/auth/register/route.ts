import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { attachSessionCookie, hashPassword, sanitizeUser, signSessionToken } from "@/lib/auth";

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().max(120),
  password: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "auth-register", 15, 60);
  if (!guard.allowed) return guard.errorResponse!;

  const parsed = await parseValidatedBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const { username, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username }] },
  });
  if (existing) {
    return jsonError("Username or email is already registered", 409, undefined, guard.headers);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      email: normalizedEmail,
      passwordHash,
      role: "USER",
    },
  });

  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
  const response = jsonOk({ user: sanitizeUser(user) }, 201, guard.headers);
  attachSessionCookie(response, token);
  return response;
}
