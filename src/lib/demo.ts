import "server-only";
import { randomUUID } from "node:crypto";
import type { DashboardData } from "@/lib/dashboard";
import type { CurrentUser } from "@/lib/auth";
import { permissionCatalog, rolePermissions, type PermissionKey } from "@/lib/permissions";

export function isDemoMode() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true";
}

export function getDemoCredentials() {
  return {
    username: process.env.DEMO_USERNAME ?? "hoteladmin",
    password: process.env.DEMO_PASSWORD ?? "AureliaTest!2026",
  };
}

type DemoRole = { id: string; name: string };
export type DemoUser = {
  id: string;
  email: string;
  username: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  authVersion: number;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
};

const initialRoles: DemoRole[] = Object.keys(rolePermissions).map((name) => ({
  id: `demo-role-${name.toLowerCase().replaceAll(" ", "-")}`,
  name,
}));

const demoGlobal = globalThis as typeof globalThis & {
  aureliaDemoState?: {
    roles: DemoRole[];
    users: DemoUser[];
    hotel: Record<string, string>;
    preferences: Record<string, Record<string, boolean>>;
    activities: DashboardData["activities"];
    passwordOverrides: Record<string, string>;
  };
};

function getState() {
  if (!demoGlobal.aureliaDemoState) {
    const now = new Date();
    const adminRole = initialRoles.find((role) => role.name === "Super Admin")!;
    const createUser = (
      id: string,
      email: string,
      username: string | null,
      firstName: string,
      lastName: string,
      roleName: string,
      daysAgo: number,
      active = true,
    ): DemoUser => {
      const createdAt = new Date(now.getTime() - daysAgo * 86_400_000);
      return {
        id,
        email,
        username,
        passwordHash: "",
        firstName,
        lastName,
        isActive: active,
        authVersion: 0,
        roleId: initialRoles.find((role) => role.name === roleName)?.id ?? adminRole.id,
        createdAt,
        updatedAt: createdAt,
      };
    };
    const credentials = getDemoCredentials();
    demoGlobal.aureliaDemoState = {
      roles: initialRoles,
      users: [
        createUser("demo-admin", "admin@aurelia.example", credentials.username, "Hotel", "Administrator", "Super Admin", 220),
        createUser("demo-user-1", "maya.perera@aurelia.example", "mayap", "Maya", "Perera", "Hotel Manager", 180),
        createUser("demo-user-2", "kasun.silva@aurelia.example", "kasuns", "Kasun", "Silva", "Receptionist", 145),
        createUser("demo-user-3", "nisha.jayawardena@aurelia.example", "nishaj", "Nisha", "Jayawardena", "Accountant", 120),
        createUser("demo-user-4", "arjun.fernando@aurelia.example", "arjunf", "Arjun", "Fernando", "HR Manager", 99),
        createUser("demo-user-5", "amal.peris@aurelia.example", "amalp", "Amal", "Peris", "Restaurant Manager", 75),
        createUser("demo-user-6", "dilani.wijesinghe@aurelia.example", "dilaniw", "Dilani", "Wijesinghe", "Inventory Manager", 52),
        createUser("demo-user-7", "sachini.dias@aurelia.example", "sachinid", "Sachini", "Dias", "Housekeeping Staff", 30),
        createUser("demo-user-8", "ravindu.karunaratne@aurelia.example", "ravinduk", "Ravindu", "Karunaratne", "Maintenance Staff", 18),
        createUser("demo-user-9", "tharushi.dealwis@aurelia.example", null, "Tharushi", "De Alwis", "Receptionist", 6, false),
      ],
      hotel: {
        hotelName: "Aurelia Hotel Collection",
        hotelAddress: "42 Galle Face Terrace, Colombo 03, Sri Lanka",
        hotelEmail: "hello@aurelia.example",
        hotelPhone: "+94 11 234 5678",
        hotelLogoUrl: "",
        currency: "LKR",
        timezone: "Asia/Colombo",
      },
      preferences: {},
      activities: [
        { id: "demo-activity-1", action: "Room status updated", entity: "Room", actor: "Kasun Silva", createdAt: new Date(now.getTime() - 13 * 60_000).toISOString() },
        { id: "demo-activity-2", action: "Reservation confirmed", entity: "Reservation", actor: "Maya Perera", createdAt: new Date(now.getTime() - 42 * 60_000).toISOString() },
        { id: "demo-activity-3", action: "Payment recorded", entity: "Payment", actor: "Nisha Jayawardena", createdAt: new Date(now.getTime() - 95 * 60_000).toISOString() },
        { id: "demo-activity-4", action: "Maintenance scheduled", entity: "Maintenance", actor: "Ravindu Karunaratne", createdAt: new Date(now.getTime() - 4 * 3_600_000).toISOString() },
      ],
      passwordOverrides: {},
    };
  }
  return demoGlobal.aureliaDemoState;
}

export function getDemoCurrentUser(userId: string): CurrentUser | null {
  const account = getState().users.find((user) => user.id === userId && user.isActive);
  if (!account) return null;
  const role = getState().roles.find((item) => item.id === account.roleId);
  if (!role) return null;
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    isActive: account.isActive,
    roleId: account.roleId,
    roleName: role.name,
    createdAt: account.createdAt,
    preferences: getState().preferences[account.id] ?? {},
    permissions: rolePermissions[role.name] ?? [],
  };
}

export function findDemoUser(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return getState().users.find(
    (user) =>
      user.isActive &&
      (user.email.toLowerCase() === normalized || user.username?.toLowerCase() === normalized),
  ) ?? null;
}

export function getDemoUsers() {
  return getState().users
    .map((user) => {
      const role = getState().roles.find(({ id }) => id === user.roleId)!;
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roleId: user.roleId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        role: { name: role.name },
      };
    })
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt));
}

export function getDemoRoles() {
  return getState().roles.map(({ id, name }) => ({ id, name }));
}

export function addDemoUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  password: string;
  roleId: string;
}) {
  const state = getState();
  if (state.users.some((user) => user.email === input.email || (input.username && user.username === input.username))) {
    return null;
  }
  const now = new Date();
  const user: DemoUser = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    username: input.username,
    passwordHash: "",
    roleId: input.roleId,
    id: `demo-user-${randomUUID()}`,
    isActive: true,
    authVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  state.users.unshift(user);
  state.passwordOverrides[user.id] = input.password;
  return user;
}

export function getDemoUserRecord(id: string) {
  return getState().users.find((user) => user.id === id) ?? null;
}

export function updateDemoUser(id: string, patch: Partial<DemoUser>) {
  const state = getState();
  const account = state.users.find((user) => user.id === id);
  if (!account) return null;
  if (state.users.some((user) => user.id !== id && (
    (patch.email && user.email === patch.email) ||
    (patch.username && user.username === patch.username)
  ))) return undefined;
  Object.assign(account, patch, { updatedAt: new Date() });
  return account;
}

export function getDemoRole(id: string) {
  return getState().roles.find((role) => role.id === id) ?? null;
}

export function countDemoSuperAdmins() {
  const state = getState();
  return state.users.filter((user) =>
    user.isActive && state.roles.find((role) => role.id === user.roleId)?.name === "Super Admin",
  ).length;
}

export function getDemoSettings(userId: string) {
  return {
    hotel: { ...getState().hotel },
    profile: {
      firstName: getDemoCurrentUser(userId)?.firstName ?? "",
      lastName: getDemoCurrentUser(userId)?.lastName ?? "",
      email: getDemoCurrentUser(userId)?.email ?? "",
      preferences: { ...getState().preferences[userId] },
    },
  };
}

export function updateDemoSettings(
  userId: string,
  input: {
    hotel?: Record<string, string>;
    profile?: { firstName?: string; lastName?: string; email?: string };
    preferences?: Record<string, boolean>;
    newPassword?: string;
  },
) {
  const state = getState();
  if (input.hotel) Object.assign(state.hotel, input.hotel);
  if (input.preferences) state.preferences[userId] = { ...input.preferences };
  const profilePatch: Partial<DemoUser> = {};
  if (input.profile?.firstName) profilePatch.firstName = input.profile.firstName;
  if (input.profile?.lastName) profilePatch.lastName = input.profile.lastName;
  if (input.profile?.email) profilePatch.email = input.profile.email;
  if (input.newPassword) setDemoPassword(userId, input.newPassword);
  if (Object.keys(profilePatch).length) updateDemoUser(userId, profilePatch);
}

export function addDemoActivity(action: string, actor: string, entity = "User") {
  getState().activities.unshift({
    id: `demo-activity-${randomUUID()}`,
    action,
    entity,
    actor,
    createdAt: new Date().toISOString(),
  });
  getState().activities.splice(8);
}

export function getDemoActivities() {
  return getState().activities;
}

export function verifyDemoPassword(accountId: string, password: string) {
  const { username, password: demoPassword } = getDemoCredentials();
  if (getState().passwordOverrides[accountId]) {
    return getState().passwordOverrides[accountId] === password;
  }
  if (accountId === "demo-admin") return username.length > 0 && password === demoPassword;
  return getState().passwordOverrides[accountId] === password;
}

export function setDemoPassword(accountId: string, password: string) {
  getState().passwordOverrides[accountId] = password;
  const account = getDemoUserRecord(accountId);
  if (account) account.authVersion += 1;
}

export function getDemoDashboard(
  canSeeFinance: boolean,
  canSeeReservations: boolean,
  currency: string,
): DashboardData {
  const today = new Date();
  const dateOnly = (offset: number) => {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    return day.toISOString().slice(0, 10);
  };
  const pastTimestamp = (hours: number) =>
    new Date(today.getTime() - hours * 3_600_000).toISOString();
  const rows = [
    { id: "demo-res-1", reference: "AUR-9K4P2", guest: "Sofia Martin", room: "302", checkIn: dateOnly(0), checkOut: dateOnly(3), amount: 148500, status: "CONFIRMED" },
    { id: "demo-res-2", reference: "AUR-7J3M8", guest: "Daniel Chen", room: "415", checkIn: dateOnly(0), checkOut: dateOnly(2), amount: 96500, status: "CHECKED_IN" },
    { id: "demo-res-3", reference: "AUR-5N8Q1", guest: "Amara Wijesinghe", room: "208", checkIn: dateOnly(1), checkOut: dateOnly(4), amount: 212000, status: "PENDING" },
    { id: "demo-res-4", reference: "AUR-2F6W9", guest: "Oliver James", room: "511", checkIn: dateOnly(-1), checkOut: dateOnly(0), amount: 127500, status: "CHECKED_IN" },
    { id: "demo-res-5", reference: "AUR-4R1B7", guest: "Leah Thompson", room: "106", checkIn: dateOnly(0), checkOut: dateOnly(1), amount: 78500, status: "CONFIRMED" },
  ] as const;
  const monthLabels = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
    return new Intl.DateTimeFormat("en", { month: "short", timeZone: "Asia/Colombo" }).format(date);
  });
  return {
    currency,
    todayLabel: new Intl.DateTimeFormat("en-LK", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Colombo",
    }).format(today),
    kpis: {
      totalRooms: 86,
      availableRooms: 24,
      occupiedRooms: 48,
      reservedRooms: 9,
      todayCheckIns: 7,
      todayCheckOuts: 5,
      totalReservations: 1248,
      monthlyRevenue: canSeeFinance ? 8_425_000 : null,
    },
    revenue: canSeeFinance
      ? monthLabels.map((month, index) => ({ month, amount: [5_650_000, 6_120_000, 6_480_000, 7_150_000, 7_820_000, 8_425_000][index] }))
      : [],
    reservationTrends: monthLabels.map((month, index) => ({ month, count: [142, 156, 169, 174, 193, 211][index] })),
    roomStatuses: [
      { status: "AVAILABLE", count: 24 },
      { status: "OCCUPIED", count: 48 },
      { status: "RESERVED", count: 9 },
      { status: "CLEANING", count: 3 },
      { status: "MAINTENANCE", count: 2 },
    ],
    reservationStatuses: [
      { status: "CONFIRMED", count: 486 },
      { status: "CHECKED_IN", count: 48 },
      { status: "PENDING", count: 32 },
      { status: "CHECKED_OUT", count: 621 },
      { status: "CANCELLED", count: 48 },
      { status: "NO_SHOW", count: 13 },
    ],
    departments: [
      { name: "Front Office", employees: 12 },
      { name: "Housekeeping", employees: 18 },
      { name: "Food & Beverage", employees: 15 },
      { name: "Finance", employees: 5 },
      { name: "Engineering", employees: 7 },
    ],
    recentReservations: canSeeReservations ? rows.map((row) => ({
      ...row,
      amount: canSeeFinance ? row.amount : null,
      currency: canSeeFinance ? currency : null,
      checkIn: `${row.checkIn}T00:00:00.000Z`,
      checkOut: `${row.checkOut}T00:00:00.000Z`,
    })) : [],
    arrivals: canSeeReservations
      ? rows.filter((row) => row.checkIn === dateOnly(0)).slice(0, 4).map((row) => ({
          ...row,
          amount: canSeeFinance ? row.amount : null,
          currency: canSeeFinance ? currency : null,
          checkIn: `${row.checkIn}T00:00:00.000Z`,
          checkOut: `${row.checkOut}T00:00:00.000Z`,
        }))
      : [],
    departures: canSeeReservations
      ? rows.filter((row) => row.checkOut === dateOnly(0)).map((row) => ({
          ...row,
          amount: canSeeFinance ? row.amount : null,
          currency: canSeeFinance ? currency : null,
          checkIn: `${row.checkIn}T00:00:00.000Z`,
          checkOut: `${row.checkOut}T00:00:00.000Z`,
        }))
      : [],
    recentPayments: canSeeFinance
      ? [
          { id: "demo-pay-1", guest: "Sofia Martin", amount: 148500, currency, status: "PAID", createdAt: pastTimestamp(1) },
          { id: "demo-pay-2", guest: "Daniel Chen", amount: 96500, currency, status: "PAID", createdAt: pastTimestamp(4) },
          { id: "demo-pay-3", guest: "Amara Wijesinghe", amount: 75000, currency, status: "AUTHORIZED", createdAt: pastTimestamp(8) },
          { id: "demo-pay-4", guest: "Oliver James", amount: 127500, currency, status: "PAID", createdAt: pastTimestamp(20) },
        ]
      : [],
    maintenance: [
      { id: "demo-maint-1", title: "Air conditioning inspection", room: "218", priority: "HIGH", scheduledAt: pastTimestamp(-28) },
      { id: "demo-maint-2", title: "Guest lift routine service", room: "General", priority: "NORMAL", scheduledAt: pastTimestamp(-53) },
      { id: "demo-maint-3", title: "Bathroom fixture repair", room: "407", priority: "LOW", scheduledAt: pastTimestamp(-74) },
    ],
    activities: getDemoActivities(),
  };
}

export function demoPermissionKeys() {
  return Object.keys(permissionCatalog) as PermissionKey[];
}

export function getDemoHotelName() {
  return getState().hotel.hotelName || "Aurelia Hotel Collection";
}

export function getDemoHotelSetting(key: string) {
  return getState().hotel[key];
}
