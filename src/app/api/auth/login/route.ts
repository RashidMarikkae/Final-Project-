import { NextResponse } from "next/server";
import { createSession, hashPassword, isSameOrigin, verifyPassword } from "@/lib/auth";
import { ensureInitialRbac } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findDemoUser, isDemoMode, verifyDemoPassword } from "@/lib/demo";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("identifier" in body) ||
      !("password" in body) ||
      typeof body.identifier !== "string" ||
      typeof body.password !== "string" ||
      body.identifier.trim().length === 0 ||
      body.identifier.length > 254 ||
      body.password.length === 0 ||
      body.password.length > 200
    ) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const identifier = body.identifier.trim().toLowerCase();
    if (isDemoMode()) {
      const demoUser = findDemoUser(identifier);
      if (!demoUser || !verifyDemoPassword(demoUser.id, body.password)) {
        return NextResponse.json(
          { error: "Those demo sign-in details weren’t recognized. Please try again." },
          { status: 401 },
        );
      }
      const rememberMe = "rememberMe" in body && body.rememberMe === true;
      await createSession(demoUser.id, rememberMe, demoUser.authVersion);
      return NextResponse.json({ redirectTo: "/dashboard" });
    }

    await ensureInitialRbac();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const passwordMatches = user
      ? await verifyPassword(body.password, user.passwordHash)
      : await hashPassword(body.password).then(() => false);
    if (!user || !user.isActive || !passwordMatches) {
      return NextResponse.json(
        { error: "Those sign-in details weren’t recognized. Please try again." },
        { status: 401 },
      );
    }

    const rememberMe = "rememberMe" in body && body.rememberMe === true;
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "Signed in",
        entityType: "User",
        entityId: user.id,
      },
    });
    await createSession(user.id, rememberMe, user.authVersion);

    const userPermissions = user.role.permissions.map(({ permission }) => permission.key);
    const destination = userPermissions.includes("dashboard:view")
      ? "/dashboard"
      : userPermissions.includes("users:manage")
        ? "/users"
        : "/settings";
    return NextResponse.json({ redirectTo: destination });
  } catch (error) {
    console.error("Authentication request failed.", error);
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly." },
      { status: 500 },
    );
  }
}
