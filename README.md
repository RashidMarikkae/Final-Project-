# Smart Hotel ERP

The project is being implemented in phases, starting with the application and database foundation. It uses Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, and Prisma.

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL 15 or newer

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `DATABASE_URL`, generate a unique `SESSION_SECRET` of at least 32 characters, and set a unique initial administrator email and password (at least 12 characters).

3. Generate the Prisma client, create/apply the development migration, and seed the initial roles and Super Admin:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Database commands

- `npm run db:generate` regenerates the Prisma client from `prisma/schema.prisma`.
- `npm run db:migrate` creates/applies a development migration.
- `npm run db:deploy` applies committed migrations in deployment environments.
- `npm run db:seed` creates the nine initial roles, their permissions, and the first Super Admin. Re-running it does not reset an existing admin password.
- `npm run db:studio` opens Prisma Studio.

Do not commit `.env` files or production credentials. `.env.example` contains placeholders only.

## Local UI demo (no database)

To explore the UI before PostgreSQL is available, stop the regular dev server and launch demo mode in PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/hotel_erp?schema=public"
$env:SESSION_SECRET = "local-demo-session-secret-change-before-deploy-123"
$env:DEMO_MODE = "true"
npm run dev
```

Sign in with username `hoteladmin` and password `AureliaTest!2026`. Demo mode is only enabled when `NODE_ENV` is `development`; it uses in-memory sample records, clearly marks the dashboard as a local demo, and does not connect to PostgreSQL. Changes made to sample users and settings last only until the development server restarts. Never enable demo mode in a deployment.

## Current scope

The application includes secure password-based sign-in, signed HTTP-only sessions, database-backed role permissions, a protected dashboard with live database statistics, user administration, hotel/profile settings, audit events, and access-controlled placeholders for planned operational modules.

The initial roles are Super Admin, Hotel Manager, Receptionist, Accountant, HR Manager, Restaurant Manager, Inventory Manager, Housekeeping Staff, and Maintenance Staff. A Super Admin has every permission. Access is checked on protected pages and API endpoints; sidebar visibility is only a usability aid.

The dashboard reports zero values and clear empty states when the database has no operational records. Financial figures are available only to roles with finance dashboard permission.

Before production use, generate and commit the reviewed database migration, configure a production-strength `SESSION_SECRET`, enable HTTPS, configure backups and monitoring, and connect an email provider before offering self-service password recovery or notification delivery.
