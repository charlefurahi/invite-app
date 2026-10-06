# Invitation + RSVP app (Supabase + Render + Vercel, free tiers)

Structure: `supabase/` (SQL), `backend/` (Express API, deployed on Render), `frontend/` (React + Vite, deployed on Vercel).

## Local run (Windows)
1. Supabase SQL Editor: run `supabase/schema.sql`, then `supabase/migration_2.sql`.
2. Backend: `cd backend`, `npm install`, `copy .env.example .env`, fill it (SECRET key), `npm run check`, `npm run dev`.
3. Frontend: `cd frontend`, `npm install`, `copy .env.example .env`, fill it (PUBLISHABLE key), `npm run dev`.
4. Open http://localhost:5173/admin

## Environment variables
Backend (Render): SUPABASE_URL, SUPABASE_SERVICE_KEY (secret key), FRONTEND_URL (Vercel URL, no trailing slash), optional RESEND_API_KEY, EMAIL_FROM, DEFAULT_COUNTRY_CODE.
Frontend (Vercel): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (publishable key), VITE_API_URL (Render URL), optional VITE_DEFAULT_COUNTRY_CODE.

## Deploy
Push to GitHub, create a Render Web Service (root dir `backend`), then a Vercel project (root dir `frontend`), then set FRONTEND_URL on Render. Never commit .env files or the secret key.
