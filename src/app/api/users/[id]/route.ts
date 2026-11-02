import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addDemoActivity,
  countDemoSuperAdmins,
  getDemoRole,
  getDemoUserRecord,
  isDemoMode,
  updateDemoUser,
} from "@/lib/demo";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "users:manage")) {
    return NextResponse.json({ error: "You don’t have permission to manage users." }, { status: 403 });
  }
  const { id } = await params;
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Enter valid user details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    (input.firstName !== undefined && (typeof input.firstName !== "string" || !input.firstName.trim() || input.firstName.length > 80)) ||
    (input.lastName !== undefined && (typeof input.lastName !== "string" || !input.lastName.trim() || input.lastName.length > 80)) ||
    (input.email !== undefined && (typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254)) ||
    (input.username !== undefined &&
      input.username !== null &&
      (typeof input.username !== "string" ||
        (input.username.trim().length > 0 &&
          (input.username.trim().length < 3 || input.username.length > 40)))) ||
    (input.isActive !== undefined && typeof input.isActive !== "boolean") ||
    (input.roleId !== undefined && typeof input.roleId !== "string")
  ) {
    return NextResponse.json({ error: "One or more user fields are invalid." }, { status: 400 });
  }

  if (isDemoMode()) {
    const target = getDemoUserRecord(id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const targetRole = getDemoRole(target.roleId);
    if (targetRole?.name === "Super Admin" && actor.roleName !== "Super Admin") {
      return NextResponse.json({ error: "Only a Super Admin can modify this account." }, { status: 403 });
    }
    if (id === actor.id && input.isActive === false) {
      return NextResponse.json({ error: "You can’t deactivate your own account." }, { status: 400 });
    }
    const patch: {
      firstName?: string; lastName?: string; email?: string; username?: string | null;
      isActive?: boolean; roleId?: string; authVersion?: number;
    } = {};
    if (typeof input.firstName === "string") patch.firstName = input.firstName.trim();
    if (typeof input.lastName === "string") patch.lastName = input.lastName.trim();
    if (typeof input.email === "string") patch.email = input.email.trim().toLowerCase();
    if (typeof input.username === "string") patch.username = input.username.trim().toLowerCase() || null;
    if (input.username === null) patch.username = null;
    if (typeof input.isActive === "boolean") patch.isActive = input.isActive;
    if (typeof input.roleId === "string") {
      const newRole = getDemoRole(input.roleId);
      if (!newRole) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
      if (newRole.name === "Super Admin" && actor.roleName !== "Super Admin") {
        return NextResponse.json({ error: "Only a Super Admin can assign this role." }, { status: 403 });
      }
      patch.roleId = newRole.id;
    }
    const removesSuperAdmin =
      targetRole?.name === "Super Admin" &&
      (patch.isActive === false || (patch.roleId !== undefined && patch.roleId !== target.roleId));
    if (removesSuperAdmin && target.isActive && countDemoSuperAdmins() <= 1) {
      return NextResponse.json({ error: "The last active Super Admin account can’t be deactivated or reassigned." }, { status: 409 });
    }
    if (patch.isActive !== undefined || patch.roleId !== undefined) {
      patch.authVersion = target.authVersion + 1;
    }
    const updated = updateDemoUser(id, patch);
    if (updated === undefined) {
      return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
    }
    if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
    addDemoActivity("Updated user", `${actor.firstName} ${actor.lastName}`);
    return NextResponse.json({
      user: { id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName },
    });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { role: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (id === actor.id && input.isActive === false) {
    return NextResponse.json({ error: "You can’t deactivate your own account." }, { status: 400 });
  }
  if (target.role.name === "Super Admin" && actor.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Only a Super Admin can modify this account." }, { status: 403 });
  }

  let roleId: string | undefined;
  if (typeof input.roleId === "string") {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    if (role.name === "Super Admin" && actor.roleName !== "Super Admin") {
      return NextResponse.json({ error: "Only a Super Admin can assign this role." }, { status: 403 });
    }
    roleId = role.id;
  }

  const isRemovingSuperAdmin =
    target.role.name === "Super Admin" &&
    (input.isActive === false || (roleId !== undefined && roleId !== target.roleId));
  if (isRemovingSuperAdmin && target.isActive) {
    const activeSuperAdmins = await prisma.user.count({
      where: { isActive: true, role: { name: "Super Admin" } },
    });
    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "The last active Super Admin account can’t be deactivated or reassigned." },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(typeof input.firstName === "string" && { firstName: input.firstName.trim() }),
        ...(typeof input.lastName === "string" && { lastName: input.lastName.trim() }),
        ...(typeof input.email === "string" && { email: input.email.trim().toLowerCase() }),
        ...(typeof input.username === "string" && {
          username: input.username.trim() ? input.username.trim().toLowerCase() : null,
        }),
        ...(input.username === null && { username: null }),
        ...(typeof input.isActive === "boolean" && { isActive: input.isActive }),
        ...(roleId && { roleId }),
        ...((roleId !== undefined || input.isActive !== undefined) && {
          authVersion: { increment: 1 },
        }),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "Updated user",
        entityType: "User",
        entityId: id,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
    }
    console.error("User update failed.", error);
    return NextResponse.json({ error: "The user could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "users:manage")) {
    return NextResponse.json({ error: "You don’t have permission to manage users." }, { status: 403 });
  }
  const { id } = await params;
  if (isDemoMode()) {
    const target = getDemoUserRecord(id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (id === actor.id) {
      return NextResponse.json({ error: "You can’t deactivate your own account." }, { status: 400 });
    }
    if (getDemoRole(target.roleId)?.name === "Super Admin" && actor.roleName !== "Super Admin") {
      return NextResponse.json({ error: "Only a Super Admin can deactivate this account." }, { status: 403 });
    }
    if (getDemoRole(target.roleId)?.name === "Super Admin" && countDemoSuperAdmins() <= 1) {
      return NextResponse.json({ error: "The last active Super Admin account can’t be deactivated." }, { status: 409 });
    }
    updateDemoUser(id, { isActive: false, authVersion: target.authVersion + 1 });
    addDemoActivity("Deactivated user", `${actor.firstName} ${actor.lastName}`);
    return NextResponse.json({ success: true });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { role: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (id === actor.id) {
    return NextResponse.json({ error: "You can’t deactivate your own account." }, { status: 400 });
  }
  if (target.role.name === "Super Admin" && actor.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Only a Super Admin can deactivate this account." }, { status: 403 });
  }
  if (target.role.name === "Super Admin" && target.isActive) {
    const activeSuperAdmins = await prisma.user.count({
      where: { isActive: true, role: { name: "Super Admin" } },
    });
    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "The last active Super Admin account can’t be deactivated." },
        { status: 409 },
      );
    }
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false, authVersion: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "Deactivated user",
      entityType: "User",
      entityId: id,
    },
  });
  return NextResponse.json({ success: true });
}
