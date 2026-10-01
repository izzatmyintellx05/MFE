# Supabase Database Deployment & Vercel Connection Guide

This guide explains how to deploy your database on **Supabase** and link it to **Vercel** via connection strings.

---

## Part 1: Deploy Database on Supabase

### Step 1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and click **New Project** (or visit [database.new](https://database.new)).
2. Configure:
   - **Name**: `mfe-mr11-production`
   - **Database Password**: Set a strong password (save this safely).
   - **Region**: Choose the region closest to your users or Vercel deployment.
3. Click **Create new project** and wait ~1 minute for provisioning.

---

### Step 2: Deploy Schema to Supabase

You can deploy the schema in either of two ways:

#### Option A: Direct SQL Editor (Recommended - 1 Click)
1. In the Supabase Dashboard, click **SQL Editor** on the left menu.
2. Click **New query**.
3. Copy the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and paste it into the editor.
4. Click **Run** (or `Ctrl+Enter`).
5. All 10 tables, enums (`RoleCode`, `Mr11Status`, `FileVersionStatus`), indexes, foreign keys, and initial seed records (roles, 7 departments, and default root admin) are created instantly.

#### Option B: Via Prisma CLI
From your local terminal with your Supabase connection string:
```bash
# Push schema directly
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" npm run db:push

# Seed roles, departments, and admin user
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" npm run db:seed
```

---

## Part 2: Connect Supabase with Vercel

### Step 1: Verified Supabase Connection String
Your Supabase project ID is `qbjoclyhqctgrvlrqvgf` (located in region `ap-southeast-1` Singapore).

The verified connection strings with your updated password:
- **Transaction Pooler (Recommended for Vercel Serverless Functions):**
  ```
  postgresql://postgres.qbjoclyhqctgrvlrqvgf:[PWD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- **Direct Connection:**
  ```
  postgresql://postgres:[PWD]@db.qbjoclyhqctgrvlrqvgf.supabase.co:5432/postgres
  ```

---

### Step 2: Add Environment Variables in Vercel
1. Go to your project on the [Vercel Dashboard](https://vercel.com/dashboard).
2. Navigate to **Settings** → **Environment Variables**.
3. Add the following variables:

| Variable Key | Value | Notes |
| :--- | :--- | :--- |
| **`DATABASE_URL`** | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` | Supabase Transaction Pooler URI |
| **`DIRECT_URL`** | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres` | Optional: direct connection for migrations |
| **`JWT_SECRET`** | `mfe-formwork-enterprise-secret-2026` | Token signing secret |
| **`NODE_ENV`** | `production` | Set to production |

4. Check all environments (**Production**, **Preview**, **Development**).
5. Click **Save**.

---

### Step 3: Trigger Redeployment in Vercel
1. In Vercel, go to the **Deployments** tab.
2. On the latest deployment, click the three dots (`...`) → **Redeploy**.
3. The build script executes:
   ```bash
   npm run build
   ```
   This compiles the Vite frontend into `dist/` and bundles `server/vercel.ts` into a standalone serverless function in `api/index.js`.
4. Once deployed:
   - Frontend: `https://<your-project>.vercel.app/`
   - Health Check: `https://<your-project>.vercel.app/health`
   - API: `https://<your-project>.vercel.app/api/departments`
   - Sign in with `admin@mfeformwork.com` / `admin123`.

---

## Part 3: Fixing `ERR_MODULE_NOT_FOUND` on Vercel

If you previously encountered:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/app' imported from /var/task/api/index.js
```

### Why it happened
In Node ESM (`"type": "module"`), relative imports like `../server/app` must either have explicit extensions or be bundled. Vercel's serverless function runtime (`/var/task/api/index.js`) did not have access to unbundled TypeScript files in `/var/task/server/`.

### How it is fixed
The build script in `package.json` now bundles the serverless function using `esbuild`:
```json
"build": "vite build && esbuild server/vercel.ts --bundle --platform=node --target=node22 --format=esm --outfile=api/index.js --packages=external"
```
This produces a single, self-contained `api/index.js` file with all backend routes, modules, and Prisma handlers bundled together, eliminating any missing relative imports.
