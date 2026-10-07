# Invitation + RSVP app (Supabase + Render + Netlify, free tiers)

Structure: `supabase/` (SQL), `backend/` (Express API, deployed on Render), `frontend/` (React + Vite, deployed on Netlify).

## Local run (Windows)
1. Supabase SQL Editor: run `supabase/schema.sql`, then `supabase/migration_2.sql`.
2. Backend: `cd backend`, `npm install`, `copy .env.example .env`, fill it (SECRET key), `npm run check`, `npm run dev`.
3. Frontend: `cd frontend`, `npm install`, `copy .env.example .env`, fill it (PUBLISHABLE key), `npm run dev`.
4. Open http://localhost:5173/admin

## Environment variables
Backend (Render): SUPABASE_URL, SUPABASE_SERVICE_KEY (secret key), FRONTEND_URL (Netlify URL, no trailing slash), optional RESEND_API_KEY, EMAIL_FROM, DEFAULT_COUNTRY_CODE.
Frontend (Netlify): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (publishable key), VITE_API_URL (Render URL), optional VITE_DEFAULT_COUNTRY_CODE.

## Deploy
Push to GitHub, create a Render Web Service (root dir `backend`), then a Netlify project (root dir `frontend`), then set FRONTEND_URL on Render. Never commit .env files or the secret key.

## Keep Render awake
Free plan sleeps after 15 min idle. Add a free monitor at uptimerobot.com (HTTP(s), every 5 minutes) on https://YOUR-RENDER-URL/health.

## Netlify settings
Base directory `frontend`, build command `npm run build`, publish directory `dist` (also set in `frontend/netlify.toml`).
Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_API_URL (your Render URL, no trailing slash) under Site configuration > Environment variables, then trigger a new deploy: Vite bakes them in at build time.
A "Request failed (404)" on the admin page means VITE_API_URL is missing, so the app calls Netlify itself instead of Render.
On Render set FRONTEND_URL to your Netlify URL. In Supabase > Authentication > URL Configuration use the same URL.
