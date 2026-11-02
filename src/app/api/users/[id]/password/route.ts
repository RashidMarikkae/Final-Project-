import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, hasPermission, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDemoActivity, getDemoRole, getDemoUserRecord, isDemoMode, setDemoPassword } from "@/lib/demo";

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
  if (
    typeof body !== "object" ||
    body === null ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 200
  ) {
    return NextResponse.json(
      { error: "The new password must be at least 12 characters." },
      { status: 400 },
    );
  }

  if (isDemoMode()) {
    const target = getDemoUserRecord(id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (getDemoRole(target.roleId)?.name === "Super Admin" && actor.roleName !== "Super Admin") {
      return NextResponse.json({ error: "Only a Super Admin can reset this password." }, { status: 403 });
    }
    setDemoPassword(id, body.password);
    addDemoActivity("Reset user password", `${actor.firstName} ${actor.lastName}`);
    return NextResponse.json({ success: true });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { role: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role.name === "Super Admin" && actor.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Only a Super Admin can reset this password." }, { status: 403 });
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(body.password),
      authVersion: { increment: 1 },
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "Reset user password",
      entityType: "User",
      entityId: id,
    },
  });
  return NextResponse.json({ success: true });
}
