"use client";

import { useState } from "react";
import { Icon } from "@/app/components/ui-icon";
import { PortalShell } from "@/app/components/portal-shell";
import type { DashboardData } from "@/lib/dashboard";
import type { CurrentUser } from "@/lib/auth";

function formatCurrency(value: number, currency = "LKR") {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function displayStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const statusClass = (value: string) => value.toLowerCase().replaceAll("_", "-");

export function DashboardView({
  user,
  data,
  canSeeFinance,
  canSeeReservationDetails,
  hotelName,
  demoMode = false,
}: {
  user: CurrentUser;
  data: DashboardData;
  canSeeFinance: boolean;
  canSeeReservationDetails: boolean;
  hotelName: string;
  demoMode?: boolean;
}) {
  const [chartPeriod, setChartPeriod] = useState<"revenue" | "reservations">("revenue");
  const firstName = user.firstName || "there";
  const reservationPoints = data.reservationTrends;
  const maximumRevenue = Math.max(1, ...data.revenue.map(({ amount }) => amount));
  const maximumReservations = Math.max(1, ...reservationPoints.map(({ count }) => count));
  const totalRoomsByStatus = data.roomStatuses.reduce((sum, item) => sum + item.count, 0);
  const occupiedCount = data.roomStatuses.find(({ status }) => status === "OCCUPIED")?.count ?? 0;
  const occupancyPercent = totalRoomsByStatus ? Math.round((occupiedCount / totalRoomsByStatus) * 100) : 0;
  const revenuePolyline = data.revenue
    .map(({ amount }, index) => {
      const x = 26 + index * 75;
      const y = 116 - (amount / maximumRevenue) * 80;
      return `${x},${y}`;
    })
    .join(" ");
  const reservationPolyline = reservationPoints
    .map(({ count }, index) => `${26 + index * 75},${116 - (count / maximumReservations) * 80}`)
    .join(" ");

  const metrics = [
    { label: "Total rooms", value: data.kpis.totalRooms, icon: "building" as const, color: "navy", detail: "Across all categories" },
    { label: "Available rooms", value: data.kpis.availableRooms, icon: "check" as const, color: "green", detail: "Ready for guests" },
    { label: "Occupied rooms", value: data.kpis.occupiedRooms, icon: "users" as const, color: "blue", detail: `${occupancyPercent}% occupancy` },
    { label: "Reserved rooms", value: data.kpis.reservedRooms, icon: "calendar" as const, color: "gold", detail: "Upcoming stays" },
    { label: "Today's check-ins", value: data.kpis.todayCheckIns, icon: "arrow" as const, color: "purple", detail: "Expected arrivals" },
    { label: "Today's check-outs", value: data.kpis.todayCheckOuts, icon: "logout" as const, color: "rose", detail: "Scheduled departures" },
    { label: "Total reservations", value: data.kpis.totalReservations, icon: "calendar" as const, color: "teal", detail: "All-time bookings" },
  ];

  return (
    <PortalShell user={user} dateLabel={data.todayLabel} activities={data.activities} hotelName={hotelName} demoMode={demoMode}>
      <div className="dashboard-page">
        <div className="page-heading dashboard-heading">
          <div>
            <div className="breadcrumb">Overview <Icon name="chevron" size={14} /> Dashboard</div>
            <h1>Good morning, {firstName}<span className="greeting-spark">✦</span></h1>
            <p>Here’s what’s happening across your property today.</p>
          </div>
          <button className="outline-button" onClick={() => window.location.reload()}>
            <Icon name="activity" size={17} /> Refresh data
          </button>
        </div>

        <section className="metric-grid" aria-label="Key performance indicators">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className={`metric-icon metric-${metric.color}`}><Icon name={metric.icon} size={19} /></div>
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value">{metric.value.toLocaleString("en-LK")}</strong>
              <span className="metric-detail">{metric.detail}</span>
            </article>
          ))}
          <article className={`metric-card revenue-metric${!canSeeFinance ? " metric-restricted" : ""}`}>
            <div className="metric-icon metric-gold"><Icon name="wallet" size={19} /></div>
            <span className="metric-label">Monthly revenue</span>
            <strong className="metric-value">{canSeeFinance ? formatCurrency(data.kpis.monthlyRevenue ?? 0, data.currency) : "Restricted"}</strong>
            <span className="metric-detail">{canSeeFinance ? "Paid invoices · this month" : "Finance permission required"}</span>
          </article>
        </section>

        <section className="analytics-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-overline">PERFORMANCE</span>
                <h2>{chartPeriod === "revenue" ? "Revenue overview" : "Reservation trends"}</h2>
                <p>Six-month performance at a glance</p>
              </div>
              <div className="segmented-control" aria-label="Chart selection">
                <button className={chartPeriod === "revenue" ? "active" : ""} onClick={() => setChartPeriod("revenue")}>Revenue</button>
                <button className={chartPeriod === "reservations" ? "active" : ""} onClick={() => setChartPeriod("reservations")}>Bookings</button>
              </div>
            </div>
            {chartPeriod === "revenue" && !canSeeFinance ? (
              <div className="chart-empty"><Icon name="shield" size={24} /><strong>Finance data is restricted</strong><span>Ask your administrator for access to revenue analytics.</span></div>
            ) : (
              <div className="line-chart">
                <div className="chart-axis">
                  {[0, 1, 2, 3].map((line) => <span key={line}>{chartPeriod === "revenue" ? formatCurrency((maximumRevenue / 3) * (3 - line), data.currency) : Math.round((maximumReservations / 3) * (3 - line))}</span>)}
                </div>
                <svg viewBox="0 0 400 145" role="img" aria-label={chartPeriod === "revenue" ? "Revenue over the last six months" : "Reservations over the last six months"}>
                  {[20, 52, 84, 116].map((y) => <line key={y} x1="25" x2="395" y1={y} y2={y} className="chart-grid-line" />)}
                  <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c6a66b" stopOpacity=".22" /><stop offset="100%" stopColor="#c6a66b" stopOpacity="0" /></linearGradient></defs>
                  <polygon points={`26,116 ${chartPeriod === "revenue" ? revenuePolyline : reservationPolyline} 401,116`} fill="url(#chartFill)" />
                  <polyline points={chartPeriod === "revenue" ? revenuePolyline : reservationPolyline} className="chart-line" />
                  {(chartPeriod === "revenue" ? data.revenue : reservationPoints).map((point, index) => {
                    const value = chartPeriod === "revenue" ? (point as DashboardData["revenue"][number]).amount : (point as DashboardData["reservationTrends"][number]).count;
                    const y = 116 - (value / (chartPeriod === "revenue" ? maximumRevenue : maximumReservations)) * 80;
                    return <circle key={point.month} cx={26 + index * 75} cy={y} r="4" className="chart-point" />;
                  })}
                </svg>
                <div className="chart-months">{(chartPeriod === "revenue" ? data.revenue : reservationPoints).map((point) => <span key={point.month}>{point.month}</span>)}</div>
              </div>
            )}
          </article>

          <article className="panel occupancy-panel">
            <div className="panel-heading">
              <div><span className="panel-overline">ROOMS</span><h2>Occupancy</h2><p>Live room status</p></div>
              <button className="icon-button panel-more" aria-label="More room analytics"><Icon name="filter" size={18} /></button>
            </div>
            <div className="occupancy-content">
              <div className="donut-wrap">
                <svg viewBox="0 0 140 140" role="img" aria-label={`${occupancyPercent}% of rooms occupied`}>
                  <circle cx="70" cy="70" r="52" className="donut-track" />
                  <circle cx="70" cy="70" r="52" className="donut-progress" strokeDasharray={`${(occupancyPercent / 100) * 327} 327`} />
                </svg>
                <div className="donut-center"><strong>{occupancyPercent}%</strong><span>occupied</span></div>
              </div>
              <div className="occupancy-legend">
                {[
                  ["OCCUPIED", "Occupied", "status-dot-navy"],
                  ["AVAILABLE", "Available", "status-dot-green"],
                  ["RESERVED", "Reserved", "status-dot-gold"],
                  ["CLEANING", "Cleaning", "status-dot-blue"],
                ].map(([status, label, dot]) => (
                  <div className="legend-row" key={status}>
                    <span className={`legend-dot ${dot}`} /><span>{label}</span>
                    <strong>{data.roomStatuses.find((item) => item.status === status)?.count ?? 0}</strong>
                  </div>
                ))}
                {!totalRoomsByStatus && <span className="legend-empty">Room data will appear here</span>}
              </div>
            </div>
          </article>
        </section>

        <section className="overview-grid">
          <article className="panel reservations-panel">
            <div className="panel-heading">
              <div><span className="panel-overline">BOOKINGS</span><h2>Reservation status</h2></div>
              <span className="panel-count">{data.reservationStatuses.reduce((sum, item) => sum + item.count, 0)} total</span>
            </div>
            {data.reservationStatuses.length ? (
              <div className="status-distribution">
                {data.reservationStatuses.map(({ status, count }) => {
                  const total = data.reservationStatuses.reduce((sum, item) => sum + item.count, 0);
                  return (
                    <div className="distribution-row" key={status}>
                      <span>{displayStatus(status)}</span>
                      <div className="distribution-track"><i style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState title="No reservations yet" detail="New bookings will be reflected here." />}
          </article>
          <article className="panel departments-panel">
            <div className="panel-heading">
              <div><span className="panel-overline">YOUR TEAM</span><h2>Department overview</h2></div>
              <Icon name="users" size={18} className="muted-icon" />
            </div>
            {data.departments.length ? (
              <div className="department-list">
                {data.departments.slice(0, 5).map((department, index) => (
                  <div className="department-row" key={department.name}>
                    <span className={`department-avatar department-avatar-${index % 4}`}>{department.name.charAt(0)}</span>
                    <span className="department-name">{department.name}</span>
                    <span className="department-count">{department.employees} team members</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No departments yet" detail="Department information will appear here." />}
          </article>
        </section>

        <section className="tables-grid">
          <ReservationTable title="Recent reservations" caption="Your latest bookings" rows={data.recentReservations} restricted={!canSeeReservationDetails} />
          <ReservationTable title="Today's arrivals" caption="Guests checking in today" rows={data.arrivals} restricted={!canSeeReservationDetails} />
          <ReservationTable title="Today's departures" caption="Guests checking out today" rows={data.departures} restricted={!canSeeReservationDetails} />
          <article className="panel compact-table-panel">
            <div className="panel-heading"><div><span className="panel-overline">REVENUE</span><h2>Recent payments</h2></div><Icon name="wallet" size={18} className="muted-icon" /></div>
            {data.recentPayments.length ? (
              <div className="payment-list">
                {data.recentPayments.slice(0, 5).map((payment) => (
                  <div className="payment-row" key={payment.id}>
                    <span className="payment-icon"><Icon name="wallet" size={17} /></span>
                    <span className="payment-main"><strong>{payment.guest}</strong><small>{formatDate(payment.createdAt)}</small></span>
                    <span className="payment-value">{formatCurrency(payment.amount, payment.currency)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title={canSeeFinance ? "No payments yet" : "Payments are restricted"} detail={canSeeFinance ? "New payments will appear here." : "Finance permission is required."} />}
          </article>
          <article className="panel compact-table-panel">
            <div className="panel-heading"><div><span className="panel-overline">PROPERTY CARE</span><h2>Upcoming maintenance</h2></div><Icon name="wrench" size={18} className="muted-icon" /></div>
            {data.maintenance.length ? (
              <div className="maintenance-list">
                {data.maintenance.map((item) => (
                  <div className="maintenance-row" key={item.id}>
                    <span className="maintenance-icon"><Icon name="wrench" size={16} /></span>
                    <span><strong>{item.title}</strong><small>Room {item.room} · {formatDate(item.scheduledAt)}</small></span>
                    <span className={`priority-label priority-${item.priority.toLowerCase()}`}>{displayStatus(item.priority)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Nothing scheduled" detail="Upcoming maintenance will appear here." />}
          </article>
          <article className="panel compact-table-panel activity-panel">
            <div className="panel-heading"><div><span className="panel-overline">AUDIT TRAIL</span><h2>Recent activity</h2></div><Icon name="activity" size={18} className="muted-icon" /></div>
            {data.activities.length ? (
              <div className="activity-list">
                {data.activities.slice(0, 5).map((activity) => (
                  <div className="activity-row" key={activity.id}>
                    <span className="activity-indicator" />
                    <span><strong>{activity.action}</strong><small>{activity.actor} · {activity.entity}</small></span>
                    <time>{formatDate(activity.createdAt)}</time>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No activity recorded" detail="System activity will appear here." />}
          </article>
        </section>
      </div>
    </PortalShell>
  );
}

function ReservationTable({
  title,
  caption,
  rows,
  restricted = false,
}: {
  title: string;
  caption: string;
  rows: DashboardData["recentReservations"];
  restricted?: boolean;
}) {
  return (
    <article className="panel reservation-table-panel">
      <div className="panel-heading">
        <div><span className="panel-overline">RESERVATIONS</span><h2>{title}</h2><p>{caption}</p></div>
        <button className="icon-button panel-more" aria-label={`More ${title}`}><Icon name="chevron" size={18} /></button>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>GUEST</th><th>ROOM</th><th>STATUS</th><th>STAY</th></tr></thead>
            <tbody>{rows.slice(0, 4).map((reservation) => (
              <tr key={reservation.id}>
                <td><span className="guest-cell"><span className="guest-avatar">{reservation.guest.charAt(0)}</span><span><strong>{reservation.guest}</strong><small>#{reservation.reference.slice(0, 8).toUpperCase()}</small></span></span></td>
                <td>{reservation.room}</td>
                <td><span className={`status-pill status-${statusClass(reservation.status)}`}>{displayStatus(reservation.status)}</span></td>
                <td>{formatDateOnly(reservation.checkIn)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState title={restricted ? "Reservation details are restricted" : "No reservations to show"} detail={restricted ? "Reservation access is required to view guest details." : "The list will update as bookings arrive."} />}
    </article>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon name="calendar" size={18} /></span><strong>{title}</strong><p>{detail}</p></div>;
}
