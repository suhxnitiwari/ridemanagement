# RideFlow

A role-based rideshare platform with separate authenticated portals for riders, drivers, and admins. Riders book trips with real-time fare estimation, an AI destination assistant, and a built-in safety suite; drivers manage and complete assigned rides and track earnings; admins run full CRUD on all rides, riders, and drivers from a live stats dashboard.

**Production:** [rideflow-frontend.onrender.com](https://rideflow-frontend.onrender.com) &nbsp;·&nbsp; **API:** [rideflow-server.onrender.com](https://rideflow-server.onrender.com)

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18-blue?style=flat-square)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgres-neon-blue?style=flat-square)](https://neon.tech)

---

## Project Requirements Coverage (MIS 372T)

| Rubric Item | How It's Met |
|---|---|
| React + Vite, component-based | React 18 + Vite; `/components` dir with 11 reusable components |
| Multi-page with navigation | React Router v6; dedicated portals for rider, driver, admin |
| Modern UI | Custom dark theme, magenta/purple palette, Leaflet maps, responsive layout |
| ES6 throughout | Arrow functions, destructuring, async/await, modules everywhere |
| State management | `useState` / `useEffect`; Clerk session state |
| Security: elevated login for admin CRUD | Clerk roles (`rider`, `driver`, `admin`); `requireAdmin` / `requireDriver` middleware |
| Row-level auth | Riders see only their own rides/payments (`WHERE rider_id = ?`); drivers see their assigned rides |
| Node.js + Express backend | `server/index.js` with Express 4 |
| Full CRUD routes | `/api/rides`, `/api/riders`, `/api/drivers`, `/api/payments` — GET/POST/PUT/PATCH/DELETE |
| ORM | Sequelize 6 with `underscored: true` models |
| PostgreSQL database, seeded | Neon serverless PostgreSQL + `server/seed.js` |
| Deployed publicly | Render static site (frontend) + Render web service (backend) |
| Incorporate AI (Azure Foundry) | Azure OpenAI GPT-4o: AI Destination Assistant (uses ride destination from DB) + RideFlow Assistant chatbot |
| Strata platform chatbot | Strata widget in `index.html` with custom knowledge base (150+ Q&A pairs) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6, Leaflet / react-leaflet |
| Auth | Clerk (JWTs, `publicMetadata` role storage) |
| HTTP client | Axios with global `Authorization` header sync |
| Backend | Node.js 18, Express 4 |
| ORM | Sequelize 6 (`sync({ alter: true })`) |
| Database | Neon serverless PostgreSQL (SSL, us-east-1) |
| AI — Destination Assistant | Azure OpenAI GPT-4o via Azure AI Foundry (destination suggestions from ride data) |
| AI — RideFlow Assistant | Azure OpenAI GPT-4o with RideFlow knowledge system prompt; multi-turn chat with conversation history |
| AI — Chatbot | Strata platform (`strata.fyi`) with custom 150+ Q&A knowledge base |
| Geocoding | Photon (autocomplete), Nominatim (geocode), OSRM (routing) |
| Deployment | Render (static site + web service) |

---

## Features

### Rider Portal
- Book rides with real-time address autocomplete + OSRM driving route on Leaflet map
- Full fare breakdown before confirming: base $2.50 + $1.75/mi + $1.20 service fee + 8.25% TX tax, min $5.00
- Live ride tracking with 5-step status bar (Requested → Accepted → En Route → In Progress → Completed)
- Safety Help modal: Call 911, share ride details to clipboard, report driver, emergency cancel
- AI Destination Assistant powered by Azure OpenAI — suggests things to do near drop-off
- Ride history, transactions, and profile with ride preferences (temperature, music, conversation)

### Driver Portal
- Find & accept available ride requests; complete or cancel active rides
- Dashboard with today/week/month/year earnings (65% driver cut), weekly bar chart, completion rate
- My Rides history + detailed earnings payment records

### Admin Panel
- Live platform stats: total rides, revenue, active requests, driver count, average fare
- Rides by day and revenue by day bar charts; ride status distribution; platform health metrics
- Top 5 drivers leaderboard
- Full CRUD on all rides (search, filter by status, edit, delete)
- Full CRUD on all drivers (search, sort by rating/revenue, edit, remove)

### AI Features
- **RideFlow Assistant** — floating chat widget (🚗) powered by Azure OpenAI with full RideFlow knowledge system prompt; maintains conversation history; 6 quick-start chips
- **AI Destination Assistant** — uses the ride's drop-off location (from database) to generate activity suggestions via Azure OpenAI
- **Strata chatbot** — context-based chatbot with 150+ curated Q&A pairs covering booking, pricing, safety, driver info, and troubleshooting

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
| `DATABASE_URL` | Yes | Full Neon connection string, e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `DB_SSL` | Yes | `true` for Neon / any SSL-required host |
| `PORT` | No | Server port. Defaults to `3001` |
| `CLIENT_ORIGIN` | Yes | Comma-separated allowed CORS origins |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key (`sk_live_…` or `sk_test_…`) |
| `AZURE_AI_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | No | Deployment name. Defaults to `gpt-4o` |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | Full API base URL. Falls back to `/api` (Vite proxy) if unset |
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
| GET | `/api/riders/me` | Rider | Logged-in user's rider record |
| GET | `/api/riders/:id` | Any | Single rider |
| POST | `/api/riders` | Admin | Create rider |
| PUT | `/api/riders/:id` | Any | Update rider |
| DELETE | `/api/riders/:id` | Admin | Soft delete |
| GET | `/api/drivers` | Admin | List drivers (`?search=`) |
| GET | `/api/drivers/me` | Driver | Logged-in user's driver record |
| GET | `/api/drivers/stats` | Driver | Per-driver ride and revenue stats |
| GET | `/api/drivers/:id` | Any | Single driver |
| POST | `/api/drivers` | Admin | Create driver |
| PUT | `/api/drivers/:id` | Driver/Admin | Update driver |
| DELETE | `/api/drivers/:id` | Admin | Soft delete |
| GET | `/api/rides` | Any | Riders see own rows; drivers/admins see all |
| POST | `/api/rides` | Rider | Create ride; `rider_id` resolved server-side from JWT |
| PUT | `/api/rides/:id` | Driver/Admin | Update ride |
| PATCH | `/api/rides/:id/status` | Driver/Admin | Status-only update |
| DELETE | `/api/rides/:id` | Admin | Cancel ride |
| GET | `/api/payments` | Any | Own payments (rider) or all (admin) |
| POST | `/api/payments` | Rider | Create payment |
| PUT | `/api/payments/:id` | Admin | Update payment |
| DELETE | `/api/payments/:id` | Admin | Delete payment |
| POST | `/api/ai/destination-suggestions` | Rider | GPT-4o activity suggestions for a destination |
| POST | `/api/ai/chat` | Any | RideFlow Assistant — multi-turn chat with RideFlow knowledge system prompt |

---

## Authentication & Security

Roles are stored in **Clerk `publicMetadata`** (`"role": "rider" | "driver" | "admin"`). Role assignment happens at `/onboarding` after sign-up via a server-side Clerk SDK call — the client cannot self-assign a role.

Every protected route independently fetches the user from Clerk on each request and checks the role claim — the JWT payload alone is never trusted for authorization.

**Row-level security:** Riders can only read and modify their own ride and payment records. The rides controller filters `WHERE rider_id = <authenticated rider>` for all non-admin requests. Drivers can only update rides assigned to them.

The client refreshes the Clerk token every 55 seconds via `getToken()` and updates the global Axios `Authorization` header.

---

## Database Schema

Managed by Sequelize on Neon PostgreSQL. All changes are applied non-destructively via `sync({ alter: true })` on startup.

```
riders    (rider_id, first_name, last_name, email, phone_number,
           default_payment_method, rating, clerk_user_id, active, created_at, updated_at)

drivers   (driver_id, first_name, last_name, email, phone_number,
           license_plate, vehicle_model, vehicle_color, status, rating,
           clerk_user_id, created_at, updated_at)

rides     (ride_id, rider_id → riders, driver_id → drivers,
           pickup_location, dropoff_location, status, fare, created_at, updated_at)

payments  (payment_id, ride_id → rides, rider_id → riders,
           amount, payment_method, status, card_last_four, created_at, updated_at)
```

---

## Deployment

Both services run on [Render](https://render.com).

**Backend — Web Service**

| Setting | Value |
|---|---|
| Build command | `cd server && npm install` |
| Start command | `cd server && node index.js` |

**Frontend — Static Site**

| Setting | Value |
|---|---|
| Build command | `cd client && npm install && npm run build` |
| Publish directory | `client/dist` |

> **Cold-start note:** Render free-tier services sleep after 15 minutes of inactivity. The first request after sleep can take 30–60 s.

---

## Course Context

**University:** The University of Texas at Austin, McCombs School of Business  
**Course:** MIS 372T — Full-Stack Web Application Development, Spring 2026  
**Author:** Suhani Tiwari · [github.com/suhanitiwari0306](https://github.com/suhanitiwari0306)
