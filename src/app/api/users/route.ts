import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, hasPermission, isSameOrigin } from "@/lib/auth";
import { ensureInitialRbac } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  addDemoActivity,
  addDemoUser,
  getDemoRoles,
  getDemoUsers,
  isDemoMode,
} from "@/lib/demo";

function isText(value: unknown, minLength = 1, maxLength = 120): value is string {
  return typeof value === "string" && value.trim().length >= minLength && value.length <= maxLength;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "users:manage")) {
    return NextResponse.json({ error: "You don’t have permission to manage users." }, { status: 403 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ users: getDemoUsers(), roles: getDemoRoles() });
  }

  await ensureInitialRbac();
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { name: true } },
      },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
    roles,
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "users:manage")) {
    return NextResponse.json({ error: "You don’t have permission to manage users." }, { status: 403 });
  }

  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Enter valid user details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    !isText(input.firstName, 1, 80) ||
    !isText(input.lastName, 1, 80) ||
    !isText(input.email, 3, 254) ||
    !validEmail(input.email) ||
    (input.username !== undefined &&
      input.username !== null &&
      typeof input.username !== "string") ||
    (typeof input.username === "string" &&
      input.username.trim().length > 0 &&
      (input.username.trim().length < 3 || input.username.length > 40)) ||
    !isText(input.roleId, 1, 80) ||
    !isText(input.password, 12, 200)
  ) {
    return NextResponse.json(
      { error: "Enter a valid name, email, role, and password of at least 12 characters." },
      { status: 400 },
    );
  }

  if (isDemoMode()) {
    const role = getDemoRoles().find(({ id }) => id === input.roleId);
    if (!role) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    if (role.name === "Super Admin" && actor.roleName !== "Super Admin") {
      return NextResponse.json({ error: "Only a Super Admin can assign this role." }, { status: 403 });
    }
    const created = addDemoUser({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      username:
        typeof input.username === "string" && input.username.trim()
          ? input.username.trim().toLowerCase()
          : null,
      password: input.password,
      roleId: role.id,
    });
    if (!created) {
      return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
    }
    addDemoActivity("Created user", `${actor.firstName} ${actor.lastName}`);
    return NextResponse.json({ user: created }, { status: 201 });
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }
  if (role.name === "Super Admin" && actor.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Only a Super Admin can assign this role." }, { status: 403 });
  }

  try {
    const created = await prisma.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        username:
          typeof input.username === "string" && input.username.trim()
            ? input.username.trim().toLowerCase()
            : null,
        passwordHash: await hashPassword(input.password),
        roleId: role.id,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "Created user",
        entityType: "User",
        entityId: created.id,
      },
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "That email or username is already in use." },
        { status: 409 },
      );
    }
    console.error("User creation failed.", error);
    return NextResponse.json({ error: "The user could not be created." }, { status: 500 });
  }
}
