import "server-only";
import { prisma } from "@/lib/prisma";

export const permissionCatalog = {
  "dashboard:view": "View the operational dashboard",
  "dashboard:finance": "View financial dashboard data",
  "rooms:view": "View room management",
  "reservations:view": "View reservations",
  "frontdesk:view": "View front desk operations",
  "housekeeping:view": "View housekeeping operations",
  "restaurant:view": "View restaurant operations",
  "inventory:view": "View inventory",
  "employees:view": "View employee records",
  "finance:view": "View finance records",
  "maintenance:view": "View maintenance",
  "suppliers:view": "View suppliers",
  "reports:view": "View reports and analytics",
  "users:manage": "Manage system users and roles",
  "settings:view": "View personal settings",
  "settings:manage": "Manage hotel and system settings",
} as const;

export type PermissionKey = keyof typeof permissionCatalog;

export const rolePermissions: Record<string, PermissionKey[]> = {
  "Super Admin": Object.keys(permissionCatalog) as PermissionKey[],
  "Hotel Manager": [
    "dashboard:view",
    "dashboard:finance",
    "rooms:view",
    "reservations:view",
    "frontdesk:view",
    "housekeeping:view",
    "restaurant:view",
    "inventory:view",
    "employees:view",
    "finance:view",
    "maintenance:view",
    "suppliers:view",
    "reports:view",
    "settings:view",
    "settings:manage",
  ],
  Receptionist: [
    "dashboard:view",
    "rooms:view",
    "reservations:view",
    "frontdesk:view",
    "settings:view",
  ],
  Accountant: [
    "dashboard:view",
    "dashboard:finance",
    "reservations:view",
    "finance:view",
    "reports:view",
    "settings:view",
  ],
  "HR Manager": [
    "dashboard:view",
    "employees:view",
    "reports:view",
    "settings:view",
  ],
  "Restaurant Manager": [
    "dashboard:view",
    "restaurant:view",
    "inventory:view",
    "reports:view",
    "settings:view",
  ],
  "Inventory Manager": [
    "dashboard:view",
    "inventory:view",
    "suppliers:view",
    "reports:view",
    "settings:view",
  ],
  "Housekeeping Staff": [
    "dashboard:view",
    "rooms:view",
    "housekeeping:view",
    "settings:view",
  ],
  "Maintenance Staff": [
    "dashboard:view",
    "maintenance:view",
    "settings:view",
  ],
};

export async function ensureInitialRbac() {
  const permissions = await Promise.all(
    Object.entries(permissionCatalog).map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        create: { key, description },
        update: { description },
      }),
    ),
  );
  const permissionIds = new Map(permissions.map(({ key, id }) => [key, id]));

  for (const [name, keys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, description: `${name} access profile` },
      update: {},
    });

    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({
        roleId: role.id,
        permissionId: permissionIds.get(key)!,
      })),
      skipDuplicates: true,
    });
  }
}
