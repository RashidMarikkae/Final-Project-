import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SettingsView } from "@/app/components/settings-view";
import { getCurrentUser, hasPermission, homePathFor } from "@/lib/auth";
import { getHotelName } from "@/lib/hotel";
import { getDemoHotelName, isDemoMode } from "@/lib/demo";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="page-loading"><span className="spinner" />Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!hasPermission(user, "settings:view")) redirect(homePathFor(user));
  const dateLabel = new Intl.DateTimeFormat("en-LK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date());
  return (
    <SettingsView
      user={user}
      dateLabel={dateLabel}
      canManageHotel={hasPermission(user, "settings:manage")}
      hotelName={isDemoMode() ? getDemoHotelName() : await getHotelName()}
      demoMode={isDemoMode()}
    />
  );
}
