import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { UserManagement } from "@/app/components/user-management";
import { getCurrentUser, hasPermission, homePathFor } from "@/lib/auth";
import { ensureInitialRbac } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getHotelName } from "@/lib/hotel";
import { getDemoRoles, getDemoUsers, isDemoMode } from "@/lib/demo";

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="page-loading"><span className="spinner" />Loading user management...</div>}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!hasPermission(user, "users:manage")) redirect(homePathFor(user));
  if (isDemoMode()) {
    const dateLabel = new Intl.DateTimeFormat("en-LK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Colombo",
    }).format(new Date());
    return (
      <UserManagement
        user={user}
        dateLabel={dateLabel}
        initialUsers={getDemoUsers()}
        initialRoles={getDemoRoles()}
        hotelName="Aurelia Hotel Collection"
        demoMode
      />
    );
  }
  await ensureInitialRbac();
  const [users, roles, hotelName] = await Promise.all([
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
    getHotelName(),
  ]);
  const userRows = users.map((account) => ({
    ...account,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }));
  const dateLabel = new Intl.DateTimeFormat("en-LK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date());
  return (
    <UserManagement
      user={user}
      dateLabel={dateLabel}
      initialUsers={userRows}
      initialRoles={roles}
      hotelName={hotelName}
    />
  );
}
