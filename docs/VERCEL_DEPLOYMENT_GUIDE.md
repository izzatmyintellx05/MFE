# Vercel Deployment Guide

This guide details how to deploy the **MFE Formwork MR11 Fullstack System** to **Vercel**.

The project is pre-configured with:
- [`vercel.json`](../vercel.json): Routes `/api/*` and `/health` to serverless function endpoints, and serves the Vite SPA from `dist/` with client-side route fallback.
- [`api/index.ts`](../api/index.ts): Express serverless handler.

---

## Method 1: Deploy with Vercel CLI (Fastest)

Run the following command in the project directory:

```bash
# 1. Login to Vercel (if not already logged in)
npx vercel login

# 2. Deploy directly
npx vercel

# 3. For production deployment
npx vercel --prod
```

When prompted:
- **Set up and deploy?**: `y`
- **Which scope?**: Choose your personal or team account
- **Link to existing project?**: `N`
- **Project name**: `mfe-formwork-mr11`
- **In which directory is your code located?**: `./`
- **Want to modify settings?**: `N` (settings are auto-read from `vercel.json`)

---

## Method 2: Deploy from GitHub / Azure Repos / GitLab via Vercel Dashboard

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Go to [https://vercel.com/new](https://vercel.com/new).
3. Import the repository.
4. Framework Preset will auto-detect **Vite**.
5. Configure Environment Variables:
   - `JWT_SECRET`: Enter a secure random string (e.g., `mfe-prod-jwt-secret-key-2026`)
6. Click **Deploy**.

---

## Required Environment Variables on Vercel

In **Vercel Project Settings** → **Environment Variables**, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | `mfe-prod-enterprise-key-2026` | Token encryption secret |
| `NODE_ENV` | `production` | Set environment to production |

---

## Verification After Deployment

Once deployed, verify:
- **Frontend SPA**: `https://<your-project>.vercel.app/`
- **Health Check**: `https://<your-project>.vercel.app/health`
- **API Endpoint**: `https://<your-project>.vercel.app/api/departments`
- **Sign In**: Login with `admin@mfeformwork.com` / `admin123` or use the one-click **Quick Login** button.
