# RideFlow

A role-based rideshare platform with separate authenticated portals for riders, drivers, and admins. Riders book trips with real-time fare estimation and an AI destination assistant; drivers manage and complete assigned rides; admins run full CRUD on the rider and driver roster.

**Production:** [rideflow-frontend.onrender.com](https://rideflow-frontend.onrender.com) &nbsp;·&nbsp; **API:** [rideflow-server.onrender.com](https://rideflow-server.onrender.com)

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18-blue?style=flat-square)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgres-neon-blue?style=flat-square)](https://neon.tech)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, Leaflet / react-leaflet |
| Auth | Clerk (JWTs, `publicMetadata` role storage) |
| HTTP client | Axios with global `Authorization` header sync |
| Backend | Node.js 18, Express 4 |
| ORM | Sequelize 6 (`sync({ alter: true })`) |
| Database | Neon serverless PostgreSQL (SSL, us-east-1) |
| AI | Azure OpenAI GPT-4o via Azure AI Foundry |
| Geocoding | Photon (autocomplete), Nominatim (geocode), OSRM (routing) |
| Deployment | Render (static site + web service) |

---

## Local Development

**Prerequisites:** Node.js ≥ 18, a Neon (or any PostgreSQL) database, a Clerk application, an Azure OpenAI deployment.

```bash
git clone https://github.com/suhanitiwari0306/MIS372T_Rideshare_App.git
cd MIS372T_Rideshare_App

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env   # fill in values — see table below
# create client/.env with VITE_* vars

# Start backend (http://localhost:3001)
cd server && npm run dev

# Start frontend in a separate terminal (http://localhost:5173)
cd client && npm run dev
```

Vite proxies all `/api/*` requests to `localhost:3001` — no CORS setup needed locally. Sequelize creates and syncs all tables on first boot via `sync({ alter: true })`.

---

## Environment Variables

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full Neon connection string, e.g. `postgresql://user:pass@host/db?sslmode=require&channel_binding=require` |
| `DB_SSL` | Yes | `true` for Neon / any SSL-required host |
| `PORT` | No | Server port. Defaults to `3001` |
| `CLIENT_ORIGIN` | Yes | Comma-separated allowed CORS origins, e.g. `http://localhost:5173,https://rideflow-frontend.onrender.com` |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key (`sk_live_…` or `sk_test_…`) |
| `AZURE_AI_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | No | Deployment name. Defaults to `gpt-4o` |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | Full API base URL, e.g. `https://rideflow-server.onrender.com/api`. Falls back to `/api` (Vite proxy) if unset |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_live_…` or `pk_test_…`) |

---

## API Reference

Base URL: `https://rideflow-server.onrender.com`  
All protected endpoints require `Authorization: Bearer <clerk-jwt>`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | None | Health check |
| GET | `/api/auth/me` | Any | Current user Clerk profile + role |
| GET | `/api/riders` | Admin | List riders (`?search=`) |
| GET | `/api/riders/me` | Rider | Logged-in user's rider record (auto-links `clerk_user_id`) |
| GET | `/api/riders/:id` | Any | Single rider |
| POST | `/api/riders` | Admin | Create rider |
| PUT | `/api/riders/:id` | Any | Update rider |
| DELETE | `/api/riders/:id` | Admin | Soft delete |
| GET | `/api/drivers` | Admin | List drivers (`?search=`) |
| GET | `/api/drivers/me` | Driver | Logged-in user's driver record (auto-links `clerk_user_id`) |
| GET | `/api/drivers/stats` | Driver | Per-driver ride and revenue stats |
| GET | `/api/drivers/:id` | Any | Single driver |
| POST | `/api/drivers` | Admin | Create driver |
| PUT | `/api/drivers/:id` | Driver/Admin | Update driver |
| DELETE | `/api/drivers/:id` | Admin | Soft delete |
| GET | `/api/rides` | Any | Riders see own rows; drivers/admins see all. `?status=`, `?statuses=a,b`, `?search=` |
| POST | `/api/rides` | Rider | Create ride; `rider_id` resolved server-side from JWT |
| PUT | `/api/rides/:id` | Driver/Admin | Update ride |
| PATCH | `/api/rides/:id/status` | Driver/Admin | Status-only update |
| DELETE | `/api/rides/:id` | Admin | Cancel ride |
| GET | `/api/payments` | Any | Own payments (rider) or all (admin) |
| POST | `/api/payments` | Rider | Create payment |
| PUT | `/api/payments/:id` | Admin | Update payment |
| DELETE | `/api/payments/:id` | Admin | Delete payment |
| POST | `/api/ai/destination-suggestions` | Rider | GPT-4o activity suggestions for a destination |

---

## Authentication

Roles are stored in **Clerk `publicMetadata`** (`"role": "rider" | "driver" | "admin"`). Role assignment happens at `/onboarding` after sign-up via a server-side Clerk SDK call — the client cannot self-assign a role.

Every protected route independently fetches the user from Clerk on each request and checks the role claim — the JWT payload alone is never trusted for authorization.

The client refreshes the Clerk token every 55 seconds via `getToken()` and updates the global Axios `Authorization` header. Sensitive calls (book ride, AI suggestions) trigger an additional pre-call refresh to prevent stale-JWT 401s.

---

## Deployment

Both services run on [Render](https://render.com).

**Backend — Web Service**

| Setting | Value |
|---|---|
| Build command | `cd server && npm install` |
| Start command | `cd server && node index.js` |
| Root directory | *(repo root)* |

**Frontend — Static Site**

| Setting | Value |
|---|---|
| Build command | `cd client && npm install && npm run build` |
| Publish directory | `client/dist` |
| Root directory | *(repo root)* |

Set all `server/.env` variables in Render's environment panel for the backend service. Set `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` for the static site — Vite inlines `VITE_*` vars at build time, so changes require a redeploy.

> **Cold-start note:** Render free-tier services sleep after 15 minutes of inactivity. The first request after sleep can take 30–60 s. The app surfaces a visible error banner prompting the user to retry.

---

## Database Schema

Managed by Sequelize on Neon PostgreSQL. All changes are applied non-destructively via `sync({ alter: true })` on startup.

```
riders    (rider_id, first_name, last_name, email, phone_number,
           default_payment_method, rating, clerk_user_id, active, created_at, updated_at)

drivers   (driver_id, first_name, last_name, email, phone_number,
           license_plate, vehicle_model, status, rating, clerk_user_id, created_at, updated_at)

rides     (ride_id, rider_id → riders, driver_id → drivers,
           pickup_location, dropoff_location, status, fare, created_at, updated_at)

payments  (payment_id, ride_id → rides, rider_id → riders,
           amount, payment_method, status, created_at, updated_at)
```

---

## Course Context

**University:** The University of Texas at Austin, McCombs School of Business  
**Course:** MIS 372T — Full-Stack Web Application Development, Spring 2026  
**Author:** Suhani Tiwari · [github.com/suhanitiwari0306](https://github.com/suhanitiwari0306)