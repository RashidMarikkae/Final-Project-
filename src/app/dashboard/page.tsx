import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardView } from "@/app/components/dashboard-view";
import { getCurrentUser, hasPermission, homePathFor } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { getDemoDashboard, getDemoHotelName, getDemoHotelSetting, isDemoMode } from "@/lib/demo";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="page-loading"><span className="spinner" />Loading your dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!hasPermission(user, "dashboard:view")) redirect(homePathFor(user));

  const canSeeFinance = hasPermission(user, "dashboard:finance");
  const canSeeReservations = hasPermission(user, "reservations:view");
  if (isDemoMode()) {
    return (
      <DashboardView
        user={user}
        data={getDemoDashboard(
          canSeeFinance,
          canSeeReservations,
          getDemoHotelSetting("currency") ?? "LKR",
        )}
        canSeeFinance={canSeeFinance}
        canSeeReservationDetails={canSeeReservations}
        hotelName={getDemoHotelName()}
        demoMode
      />
    );
  }

  const settings = await prisma.hotelSetting.findMany({
    where: { key: { in: ["hotelName", "currency"] } },
    select: { key: true, value: true },
  });
  const settingMap = new Map(settings.map(({ key, value }) => [key, value]));
  const data = await getDashboardData(
    canSeeFinance,
    settingMap.get("currency") ?? "LKR",
    canSeeReservations,
  );
  return (
    <DashboardView
      user={user}
      data={data}
      canSeeFinance={canSeeFinance}
      canSeeReservationDetails={canSeeReservations}
      hotelName={settingMap.get("hotelName") || "Aurelia Hotel Collection"}
    />
  );
}
