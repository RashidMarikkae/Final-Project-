import "dotenv/config";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const permissionKeys = [
  "dashboard:view", "dashboard:finance", "rooms:view", "reservations:view",
  "frontdesk:view", "housekeeping:view", "restaurant:view", "inventory:view",
  "employees:view", "finance:view", "maintenance:view", "suppliers:view",
  "reports:view", "users:manage", "settings:view", "settings:manage",
];
const roles = {
  "Super Admin": permissionKeys,
  "Hotel Manager": [
    "dashboard:view", "dashboard:finance", "rooms:view", "reservations:view",
    "frontdesk:view", "housekeeping:view", "restaurant:view", "inventory:view",
    "employees:view", "finance:view", "maintenance:view", "suppliers:view",
    "reports:view", "settings:view", "settings:manage",
  ],
  Receptionist: ["dashboard:view", "rooms:view", "reservations:view", "frontdesk:view", "settings:view"],
  Accountant: ["dashboard:view", "dashboard:finance", "reservations:view", "finance:view", "reports:view", "settings:view"],
  "HR Manager": ["dashboard:view", "employees:view", "reports:view", "settings:view"],
  "Restaurant Manager": ["dashboard:view", "restaurant:view", "inventory:view", "reports:view", "settings:view"],
  "Inventory Manager": ["dashboard:view", "inventory:view", "suppliers:view", "reports:view", "settings:view"],
  "Housekeeping Staff": ["dashboard:view", "rooms:view", "housekeeping:view", "settings:view"],
  "Maintenance Staff": ["dashboard:view", "maintenance:view", "settings:view"],
};
const descriptions = Object.fromEntries(permissionKeys.map((key) => [key, `Permission: ${key}`]));

const connectionString = process.env.DATABASE_URL;
const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Set a valid INITIAL_ADMIN_EMAIL before seeding.");
}
if (!password || password.length < 12 || password.length > 200) {
  throw new Error("INITIAL_ADMIN_PASSWORD must contain between 12 and 200 characters.");
}
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const passwordHash = `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const permissionIds = new Map();
  for (const [key, description] of Object.entries(descriptions)) {
    const result = await client.query(
      `INSERT INTO "Permission" (id, key, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [randomUUID(), key, description],
    );
    permissionIds.set(key, result.rows[0].id);
  }

  const roleIds = new Map();
  for (const [name, assignedPermissions] of Object.entries(roles)) {
    const result = await client.query(
      `INSERT INTO "Role" (id, name, description, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [randomUUID(), name, `${name} access profile`],
    );
    roleIds.set(name, result.rows[0].id);
    for (const permissionKey of assignedPermissions) {
      await client.query(
        `INSERT INTO "RolePermission" ("roleId", "permissionId")
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [result.rows[0].id, permissionIds.get(permissionKey)],
      );
    }
  }

  const existing = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
  if (existing.rowCount === 0) {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase() || null;
    if (username && (username.length < 3 || username.length > 40)) {
      throw new Error("INITIAL_ADMIN_USERNAME must contain between 3 and 40 characters.");
    }
    await client.query(
      `INSERT INTO "User"
        (id, email, username, "passwordHash", "firstName", "lastName", preferences,
         "isActive", "roleId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, TRUE, $7, NOW(), NOW())`,
      [
        randomUUID(),
        email,
        username,
        passwordHash,
        process.env.INITIAL_ADMIN_FIRST_NAME?.trim() || "Hotel",
        process.env.INITIAL_ADMIN_LAST_NAME?.trim() || "Administrator",
        roleIds.get("Super Admin"),
      ],
    );
    console.log(`Created initial Super Admin: ${email}`);
  } else {
    console.log(`Initial admin ${email} already exists; no account changes were made.`);
  }

  await client.query("COMMIT");
  console.log(`Seeded ${Object.keys(roles).length} roles and ${permissionIds.size} permissions.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
