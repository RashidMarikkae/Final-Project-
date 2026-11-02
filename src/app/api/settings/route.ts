import { NextResponse } from "next/server";
import {
  getCurrentUser,
  hasPermission,
  hashPassword,
  isSameOrigin,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addDemoActivity,
  getDemoSettings,
  getDemoUsers,
  isDemoMode,
  updateDemoSettings,
  verifyDemoPassword,
} from "@/lib/demo";

const hotelKeys = [
  "hotelName",
  "hotelAddress",
  "hotelEmail",
  "hotelPhone",
  "hotelLogoUrl",
  "currency",
  "timezone",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings:view")) {
    return NextResponse.json({ error: "You don’t have permission to view settings." }, { status: 403 });
  }
  if (isDemoMode()) {
    return NextResponse.json(getDemoSettings(user.id));
  }

  const [settings, account] = await Promise.all([
    prisma.hotelSetting.findMany(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    }),
  ]);
  return NextResponse.json({
    hotel: Object.fromEntries(settings.map(({ key, value }) => [key, value])),
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferences: account?.preferences ?? {},
    },
  });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings:view")) {
    return NextResponse.json({ error: "You don’t have permission to update settings." }, { status: 403 });
  }
  const body: unknown = await request.json();
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Enter valid settings." }, { status: 400 });
  }

  const profile = isRecord(body.profile) ? body.profile : {};
  let preferences: Record<string, boolean> | undefined;
  if (body.preferences !== undefined) {
    if (!isRecord(body.preferences)) {
      return NextResponse.json({ error: "Notification preferences must be an object." }, { status: 400 });
    }
    preferences = {};
    for (const [key, value] of Object.entries(body.preferences)) {
      if (typeof value !== "boolean") {
        return NextResponse.json({ error: "Notification preferences must be enabled or disabled." }, { status: 400 });
      }
      preferences[key] = value;
    }
  }
  const hotel = isRecord(body.hotel) ? body.hotel : undefined;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : undefined;

  if (
    (profile.firstName !== undefined &&
      (typeof profile.firstName !== "string" ||
        !profile.firstName.trim() ||
        profile.firstName.length > 80)) ||
    (profile.lastName !== undefined &&
      (typeof profile.lastName !== "string" ||
        !profile.lastName.trim() ||
        profile.lastName.length > 80)) ||
    (profile.email !== undefined &&
      (typeof profile.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ||
        profile.email.length > 254))
  ) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }
  if (newPassword && (newPassword.length < 12 || newPassword.length > 200)) {
    return NextResponse.json(
      { error: "The new password must be at least 12 characters." },
      { status: 400 },
    );
  }
  if (hotel && !hasPermission(user, "settings:manage")) {
    return NextResponse.json({ error: "You don’t have permission to change hotel settings." }, { status: 403 });
  }
  const hotelValues: Array<{ key: string; value: string }> = [];
  if (hotel) {
    for (const key of hotelKeys) {
      const value = hotel[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value.length > 500) {
        return NextResponse.json({ error: `Invalid value for ${key}.` }, { status: 400 });
      }
      if (key === "hotelEmail" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return NextResponse.json({ error: "Enter a valid hotel email address." }, { status: 400 });
      }
      if (key === "currency" && !/^[A-Z]{3}$/.test(value)) {
        return NextResponse.json({ error: "Currency must be a three-letter code." }, { status: 400 });
      }
      if (key === "timezone") {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
        } catch {
          return NextResponse.json({ error: "Enter a valid timezone." }, { status: 400 });
        }
      }
      hotelValues.push({ key, value });
    }
  }

  if (isDemoMode()) {
    if (newPassword && (!currentPassword || !verifyDemoPassword(user.id, currentPassword))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
    const updatedEmail = typeof profile.email === "string"
      ? profile.email.trim().toLowerCase()
      : undefined;
    if (
      updatedEmail &&
      updatedEmail !== user.email.toLowerCase() &&
      getDemoUsers().some(
        (account) => account.email.toLowerCase() === updatedEmail && account.id !== user.id,
      )
    ) {
      return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
    }
    updateDemoSettings(user.id, {
      ...(hotel && { hotel: Object.fromEntries(hotelValues.map(({ key, value }) => [key, value])) }),
      ...(Object.keys(profile).length > 0 && {
        profile: {
          ...(typeof profile.firstName === "string" && { firstName: profile.firstName.trim() }),
          ...(typeof profile.lastName === "string" && { lastName: profile.lastName.trim() }),
          ...(typeof profile.email === "string" && { email: profile.email.trim().toLowerCase() }),
        },
      }),
      ...(preferences && { preferences }),
      ...(newPassword && { newPassword }),
    });
    addDemoActivity("Updated settings", `${user.firstName} ${user.lastName}`, "Settings");
    return NextResponse.json({ success: true });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!current) return NextResponse.json({ error: "Your account could not be found." }, { status: 404 });
  if (newPassword) {
    if (!currentPassword || !(await verifyPassword(currentPassword, current.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (transaction) => {
      if (Object.keys(profile).length || newPassword) {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            ...(typeof profile.firstName === "string" && { firstName: profile.firstName.trim() }),
            ...(typeof profile.lastName === "string" && { lastName: profile.lastName.trim() }),
            ...(typeof profile.email === "string" && { email: profile.email.trim().toLowerCase() }),
            ...(newPassword && { passwordHash: await hashPassword(newPassword) }),
            ...(newPassword && { authVersion: { increment: 1 } }),
            ...(preferences && { preferences }),
          },
        });
      } else if (preferences) {
        await transaction.user.update({
          where: { id: user.id },
          data: { preferences },
        });
      }
      if (hotelValues.length) {
        for (const { key, value } of hotelValues) {
          await transaction.hotelSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          });
        }
      }
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "Updated settings",
          entityType: "Settings",
          entityId: user.id,
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
    }
    console.error("Settings update failed.", error);
    return NextResponse.json({ error: "Your settings could not be saved." }, { status: 500 });
  }
}
