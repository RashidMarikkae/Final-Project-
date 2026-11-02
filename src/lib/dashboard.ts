import "server-only";
import { prisma } from "@/lib/prisma";

const timeZone = "Asia/Colombo";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDateKey(date: Date) {
  const parts = dateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOnlyBounds(key: string) {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function colomboTimestampBounds(key: string) {
  const start = new Date(`${key}T00:00:00+05:30`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export async function getDashboardData(
  canSeeFinance = true,
  currency = "LKR",
  canSeeReservations = true,
) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const { start: todayStart, end: todayEnd } = dateOnlyBounds(todayKey);
  const currentMonthKey = todayKey.slice(0, 7);
  const [yearText, monthText] = currentMonthKey.split("-");
  const monthDate = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, 1),
  );
  const firstMonth = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() - 5, 1),
  );
  const monthBounds = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(
        firstMonth.getUTCFullYear(),
        firstMonth.getUTCMonth() + index,
        1,
      ),
    );
    const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());
    const { start } = colomboTimestampBounds(`${key}-01`);
    const nextMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    );
    const endOfMonth = colomboTimestampBounds(
      `${monthKey(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth())}-01`,
    ).start;
    return {
      key,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        timeZone,
      }).format(start),
      start,
      end: endOfMonth,
    };
  });
  const rangeStart = monthBounds[0].start;
  const rangeEnd = monthBounds[monthBounds.length - 1].end;

  const [
    totalRooms,
    availableRooms,
    occupiedRooms,
    reservedRooms,
    todayCheckIns,
    todayCheckOuts,
    totalReservations,
    monthlyPayments,
    recentReservations,
    arrivals,
    departures,
    recentPayments,
    maintenance,
    activities,
    roomStatuses,
    reservationStatuses,
    monthlyReservations,
    departments,
  ] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({ where: { status: "AVAILABLE" } }),
    prisma.room.count({ where: { status: "OCCUPIED" } }),
    prisma.room.count({ where: { status: "RESERVED" } }),
    prisma.reservation.count({
      where: {
        checkIn: { gte: todayStart, lt: todayEnd },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
    }),
    prisma.reservation.count({
      where: {
        checkOut: { gte: todayStart, lt: todayEnd },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    }),
    prisma.reservation.count(),
    canSeeFinance
      ? prisma.payment.findMany({
      where: {
        status: "PAID",
        currency,
        paidAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: { amount: true, paidAt: true },
        })
      : Promise.resolve([]),
    canSeeReservations
      ? prisma.reservation.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        rooms: { include: { room: { select: { roomNumber: true } } } },
      },
        })
      : Promise.resolve([]),
    canSeeReservations
      ? prisma.reservation.findMany({
      take: 6,
      where: {
        checkIn: { gte: todayStart, lt: todayEnd },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        rooms: { include: { room: { select: { roomNumber: true } } } },
      },
        })
      : Promise.resolve([]),
    canSeeReservations
      ? prisma.reservation.findMany({
      take: 6,
      where: {
        checkOut: { gte: todayStart, lt: todayEnd },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        rooms: { include: { room: { select: { roomNumber: true } } } },
      },
        })
      : Promise.resolve([]),
    canSeeFinance
      ? prisma.payment.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        reservation: {
          include: {
            customer: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
          })
        : Promise.resolve([]),
    prisma.maintenanceRequest.findMany({
      take: 5,
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      include: { room: { select: { roomNumber: true } } },
    }),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
    prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.findMany({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    }),
  ]);

  const revenueByMonth = new Map(monthBounds.map(({ key }) => [key, 0]));
  for (const payment of monthlyPayments) {
    if (!payment.paidAt) continue;
    const key = localDateKey(payment.paidAt).slice(0, 7);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(payment.amount));
  }
  const reservationsByMonth = new Map(monthBounds.map(({ key }) => [key, 0]));
  for (const reservation of monthlyReservations) {
    const key = localDateKey(reservation.createdAt).slice(0, 7);
    reservationsByMonth.set(
      key,
      (reservationsByMonth.get(key) ?? 0) + 1,
    );
  }

  const reservationDto = (reservation: (typeof recentReservations)[number]) => ({
    id: reservation.id,
    reference: reservation.reference,
    guest: reservation.customer.user
      ? `${reservation.customer.user.firstName} ${reservation.customer.user.lastName}`
      : "Guest",
    room: reservation.rooms.map(({ room }) => room.roomNumber).join(", ") || "—",
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    amount: canSeeFinance ? Number(reservation.totalAmount) : null,
    currency: canSeeFinance ? reservation.currency.trim() : null,
    status: reservation.status,
  });

  return {
    currency,
    todayLabel: new Intl.DateTimeFormat("en-LK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone,
    }).format(now),
    kpis: {
      totalRooms,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      todayCheckIns,
      todayCheckOuts,
      totalReservations,
      monthlyRevenue: canSeeFinance
        ? revenueByMonth.get(currentMonthKey) ?? 0
        : null,
    },
    revenue: canSeeFinance
      ? monthBounds.map(({ key, label }) => ({
          month: label,
          amount: revenueByMonth.get(key) ?? 0,
        }))
      : [],
    reservationTrends: monthBounds.map(({ key, label }) => ({
      month: label,
      count: reservationsByMonth.get(key) ?? 0,
    })),
    roomStatuses: roomStatuses.map(({ status, _count }) => ({
      status,
      count: _count._all,
    })),
    reservationStatuses: reservationStatuses.map(({ status, _count }) => ({
      status,
      count: _count._all,
    })),
    departments: departments.map(({ name, _count }) => ({
      name,
      employees: _count.employees,
    })),
    recentReservations: recentReservations.map(reservationDto),
    arrivals: arrivals.map(reservationDto),
    departures: departures.map(reservationDto),
    recentPayments: canSeeFinance
      ? recentPayments.map((payment) => ({
          id: payment.id,
          guest: payment.reservation.customer.user
            ? `${payment.reservation.customer.user.firstName} ${payment.reservation.customer.user.lastName}`
            : "Guest",
          amount: Number(payment.amount),
          currency: payment.currency.trim(),
          status: payment.status,
          createdAt: payment.createdAt.toISOString(),
        }))
      : [],
    maintenance: maintenance.map((request) => ({
      id: request.id,
      title: request.title,
      room: request.room?.roomNumber ?? "General",
      priority: request.priority,
      scheduledAt: request.scheduledAt.toISOString(),
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      entity: activity.entityType,
      actor: activity.actor
        ? `${activity.actor.firstName} ${activity.actor.lastName}`
        : "System",
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
