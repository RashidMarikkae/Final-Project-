import "server-only";
import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";
import { getDemoCurrentUser, getDemoUserRecord, isDemoMode } from "@/lib/demo";

const COOKIE_NAME = "hotel_erp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;
const scrypt = promisify(nodeScrypt);

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

type SessionClaims = {
  userId: string;
  authVersion: number;
  issuedAt: number;
  expiresAt: number;
};

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function readClaims(token: string): SessionClaims | null {
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;

  const expectedSignature = Buffer.from(signature(payload));
  const actualSignature = Buffer.from(suppliedSignature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("userId" in claims) ||
      !("authVersion" in claims) ||
      !("issuedAt" in claims) ||
      !("expiresAt" in claims) ||
      typeof claims.userId !== "string" ||
      typeof claims.authVersion !== "number" ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      claims.expiresAt <= Date.now()
    ) {
      return null;
    }
    return {
      userId: claims.userId,
      authVersion: claims.authVersion,
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  rememberMe: boolean,
  authVersion: number,
) {
  const issuedAt = Date.now();
  const ttl = rememberMe ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({ userId, authVersion, issuedAt, expiresAt: issuedAt + ttl * 1000 }),
  ).toString("base64url");
  const token = `${payload}.${signature(payload)}`;

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, blockSize, parallelization, saltText, hashText] =
    encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    cost !== "16384" ||
    blockSize !== "8" ||
    parallelization !== "1" ||
    !saltText ||
    !hashText
  ) {
    return false;
  }

  const expected = Buffer.from(hashText, "base64url");
  const salt = Buffer.from(saltText, "base64url");
  if (expected.length !== 64 || salt.length !== 16) return false;
  const actual = (await scrypt(
    password,
    salt,
    expected.length,
  )) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const userInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

export type CurrentUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  createdAt: Date;
  preferences: unknown;
  permissions: string[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = readClaims(token);
  if (!claims) return null;
  if (isDemoMode()) {
    const user = getDemoUserRecord(claims.userId);
    if (!user || !user.isActive || user.authVersion !== claims.authVersion) return null;
    return getDemoCurrentUser(user.id);
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    include: userInclude,
  });
  if (!user || !user.isActive || user.authVersion !== claims.authVersion) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    roleId: user.roleId,
    roleName: user.role.name,
    createdAt: user.createdAt,
    preferences: user.preferences,
    permissions: user.role.permissions.map(({ permission }) => permission.key),
  };
}

export function hasPermission(user: CurrentUser, permission: PermissionKey) {
  return user.permissions.includes(permission);
}

export function homePathFor(user: CurrentUser) {
  if (hasPermission(user, "dashboard:view")) return "/dashboard";
  if (hasPermission(user, "users:manage")) return "/users";
  return "/settings";
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
