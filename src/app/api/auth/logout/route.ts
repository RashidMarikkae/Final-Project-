import { NextResponse } from "next/server";
import { clearSession, getCurrentUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getCurrentUser();
  await clearSession();
  if (user && !isDemoMode()) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "Signed out",
        entityType: "User",
        entityId: user.id,
      },
    });
  }
  return NextResponse.json({ redirectTo: "/" });
}
