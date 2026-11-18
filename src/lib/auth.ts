import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { User, UserRole } from "@prisma/client";
import { getPrisma } from "./prisma";

export const SESSION_COOKIE_NAME = "kl_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "kl-global-tracker-dev-secret-change-in-production-2026";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateRawApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const rawKey = `kl_live_${randomPart}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 14),
    keyHash: hashApiKey(rawKey),
  };
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.userId === "string" &&
      typeof payload.username === "string" &&
      typeof payload.email === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        role: payload.role as UserRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIE !== "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function attachClearSessionCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIE !== "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    discordWebhookUrl: user.discordWebhookUrl,
    notifyWorlds: user.notifyWorlds,
    notifyCategories: user.notifyCategories,
    createdAt: user.createdAt,
  };
}

export async function getCurrentUser(request?: Request): Promise<User | null> {
  const prisma = await getPrisma();

  // 1. Check cookie via next/headers or Cookie header
  let token: string | undefined;
  if (request) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) {
      token = decodeURIComponent(match[1]);
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      token = undefined;
    }
  }

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (user) return user;
    }
  }

  // 2. Check X-API-Key or Authorization Bearer API Key
  if (request) {
    const rawKey =
      request.headers.get("x-api-key") ||
      (request.headers.get("authorization")?.startsWith("Bearer kl_")
        ? request.headers.get("authorization")!.slice("Bearer ".length).trim()
        : null);

    if (rawKey) {
      const keyHash = hashApiKey(rawKey);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { user: true },
      });
      if (apiKey && apiKey.isActive && (!apiKey.expiresAt || apiKey.expiresAt > new Date())) {
        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });
        return apiKey.user;
      }
    }
  }

  return null;
}

export async function validateApiKeyFromRequest(request: Request) {
  const rawKey =
    request.headers.get("x-api-key") ||
    (request.headers.get("authorization")?.startsWith("Bearer kl_")
      ? request.headers.get("authorization")!.slice("Bearer ".length).trim()
      : null);

  if (!rawKey) return null;
  const prisma = await getPrisma();
  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });
  if (!apiKey || !apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  return apiKey;
}

export async function requireAdmin(request: Request): Promise<User | null> {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
