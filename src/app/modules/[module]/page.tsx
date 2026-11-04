import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Icon } from "@/app/components/ui-icon";
import { PortalShell } from "@/app/components/portal-shell";
import { RoomManagementView, type RoomWorkspaceView } from "@/app/components/room-management-view";
import { OperationsWorkspace } from "@/app/components/operations-workspace";
import { getCurrentUser, hasPermission, homePathFor } from "@/lib/auth";
import { getHotelName } from "@/lib/hotel";
import { getDemoHotelName, isDemoMode } from "@/lib/demo";

const modules = {
  rooms: { title: "Room Management", group: "ROOMS & PROPERTY", permission: "rooms:view", description: "Manage room inventory, categories, room status, and facilities from one place." },
  reservations: { title: "Reservations", group: "GUEST EXPERIENCE", permission: "reservations:view", description: "Review bookings, guest details, stay dates, and reservation status." },
  "front-desk": { title: "Front Desk", group: "GUEST EXPERIENCE", permission: "frontdesk:view", description: "Support arrivals, departures, guest requests, and front desk operations." },
  housekeeping: { title: "Housekeeping", group: "ROOMS & PROPERTY", permission: "housekeeping:view", description: "Coordinate room readiness, housekeeping tasks, and service schedules." },
  restaurant: { title: "Restaurant", group: "OPERATIONS", permission: "restaurant:view", description: "Coordinate dining operations, service periods, and restaurant activity." },
  inventory: { title: "Inventory", group: "OPERATIONS", permission: "inventory:view", description: "Track stock, inventory movements, and essential property supplies." },
  employees: { title: "Employees", group: "PEOPLE", permission: "employees:view", description: "Manage employee records, departments, and team information." },
  finance: { title: "Finance", group: "BUSINESS", permission: "finance:view", description: "Review payments, invoices, and financial records." },
  maintenance: { title: "Maintenance", group: "ROOMS & PROPERTY", permission: "maintenance:view", description: "Track property maintenance requests, priorities, and scheduled work." },
  suppliers: { title: "Suppliers", group: "OPERATIONS", permission: "suppliers:view", description: "Maintain supplier relationships, contacts, and purchasing details." },
  reports: { title: "Reports & Analytics", group: "BUSINESS", permission: "reports:view", description: "Explore operational reports and performance analytics." },
} as const;

type ModuleKey = keyof typeof modules;

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  return (
    <Suspense fallback={<div className="page-loading"><span className="spinner" />Loading module...</div>}>
      <ModuleContent params={params} />
    </Suspense>
  );
}

async function ModuleContent({ params }: { params: Promise<{ module: string }> }) {
  await connection();
  const { module } = await params;
  if (!Object.hasOwn(modules, module)) notFound();
  const moduleKey = module as ModuleKey;
  const moduleInfo = modules[moduleKey];
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!hasPermission(user, moduleInfo.permission)) redirect(homePathFor(user));
  const dateLabel = new Intl.DateTimeFormat("en-LK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date());
  const roomWorkspaceView: RoomWorkspaceView | null =
    moduleKey === "rooms" ? "overview" :
      moduleKey === "reservations" ? "reservations" :
        moduleKey === "front-desk" ? "operations" : null;
  const operationsModule =
    moduleKey === "housekeeping" || moduleKey === "inventory" || moduleKey === "restaurant"
        ? moduleKey
        : null;
  return (
    <PortalShell user={user} dateLabel={dateLabel} hotelName={isDemoMode() ? getDemoHotelName() : await getHotelName()} demoMode={isDemoMode()}>
        {operationsModule
          ? <OperationsWorkspace module={operationsModule} roleName={user.roleName} userName={`${user.firstName} ${user.lastName}`} asOfDate={new Date().toISOString().slice(0, 10)} />
          : roomWorkspaceView
          ? <RoomManagementView initialView={roomWorkspaceView} roleName={user.roleName} permissions={user.permissions} />
        : <div className="placeholder-page">
          <div className="page-heading"><div><div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> {moduleInfo.title}</div><h1>{moduleInfo.title}</h1><p>{moduleInfo.description}</p></div></div>
          <section className="panel placeholder-card">
            <span className="placeholder-icon"><Icon name="building" size={25} /></span>
            <span className="placeholder-badge">COMING SOON</span>
            <h2>This module is ready for its next chapter.</h2>
            <p>{moduleInfo.title} has its own protected workspace. Detailed workflows and data tools will be added in a future release.</p>
            <div className="placeholder-separator" />
            <span className="placeholder-meta">{moduleInfo.group} <i /> Available to your role</span>
          </section>
        </div>}
    </PortalShell>
  );
}
