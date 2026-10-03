# RideFlow

*A full-stack rideshare platform with separate rider, driver and admin portals, built solo from the database up.*

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18-blue?style=flat-square)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgres-neon-blue?style=flat-square)](https://neon.tech)

**Live:** [rideflow-frontend.onrender.com](https://rideflow-frontend.onrender.com) &nbsp;·&nbsp; **API:** [rideflow-server.onrender.com](https://rideflow-server.onrender.com)
<br><sub>Both run on Render's free tier, so the first request after a quiet stretch can take 30 to 60 seconds to wake up.</sub>

## What it is

RideFlow works like a small Uber. You sign up, pick a role, and land in the portal for that role.

- **Riders** type a pickup and drop-off with live address autocomplete, see the real driving route on a map and a full fare breakdown before booking, then follow the ride through a five-step status bar (Requested → Accepted → En Route → In Progress → Completed). A Safety Help panel can call 911, copy ride details to share, report a driver, or cancel with no fee.
- **Drivers** go Available, accept open requests, mark pickup and drop-off, and track earnings by day, week, month and year with a weekly chart and completion rate.
- **Admins** get a live dashboard (rides and revenue by day, status mix, top-5 driver leaderboard) and full create, edit and delete control over rides, riders, drivers and payments, including refunds.

I built it solo for MIS 372T (Full-Stack Web Application Development) at UT Austin McCombs, Spring 2026.

## How it's built

**Roles that the client can't fake.** Auth runs on Clerk. A user's role (`rider`, `driver` or `admin`) lives in Clerk `publicMetadata` and is set by a server-side Clerk call during onboarding, so nobody can promote themselves. Every protected route looks the user up in Clerk on each request and checks the role there instead of trusting anything in the request body. The client refreshes its Clerk token every 55 seconds and keeps the Axios `Authorization` header in sync.

**Row-level security on the server.** Riders only ever see their own rides, payments and receipts. Drivers see the rides assigned to them, plus open requests while they're Available, and payments only for rides they drove. Admins see everything. The rider ID on a new ride is resolved from the signed-in user, never from the form, and a rider can't choose their own driver.

**One state machine for every ride.** All status changes go through `server/utils/rideLifecycle.js`, which defines which moves are legal and who may make them:

| Move | Who | Side effects |
|---|---|---|
| requested → accepted | An Available driver with no other active ride | Ride records the driver; driver goes on a ride |
| accepted → in progress | The assigned driver | none |
| → completed | The assigned driver or an admin | Fare charged once to the rider's saved payment method; driver is free again |
| → cancelled | The rider, the assigned driver or an admin | A rider cancelling after a driver accepted pays $2.00, waived for safety cancellations |

Nothing is charged at booking. Charges are idempotent (a ride can't be billed twice), each payment records whether it was a `fare` or a `cancellation_fee`, and every payment opens as a printable receipt. Illegal moves return clear 403 or 409 errors, like "Finish your current ride before accepting another."

**33 automated tests, no cloud accounts needed.** `cd server && npm test` loads the real models and controllers against an in-memory Postgres ([pg-mem](https://github.com/oguimbal/pg-mem)) and simulates each login. The checks cover who can see and change which rides, when fares and fees are charged, who can open which receipt, and that older bookings are settled rather than double-charged.

**Maps and routing from open data.** Address autocomplete uses Photon, geocoding uses Nominatim, and OSRM returns the real driving route and distance, drawn on a Leaflet map. Fares follow a published formula: $2.50 base + $1.75 per mile + $1.20 service fee, $5.00 minimum, plus 8.25% Texas sales tax.

**AI features.** Two endpoints call Azure OpenAI (GPT-4o): a Destination Assistant that suggests things to do near the drop-off of a booked ride, and the RideFlow Assistant, a multi-turn support chat grounded in a system prompt that describes the platform's real rules and pricing. A Strata chat widget with a custom knowledge base of 150+ Q&A pairs also sits on the site.

## Design choices

- A custom dark theme with a magenta and purple palette, built in plain CSS.
- Each role gets its own portal and navigation instead of one screen with hidden buttons.
- Riders can save ride preferences (temperature, music, conversation) on their profile.
- Error messages say what to do next instead of just "Forbidden."

## Tech stack

React 18 + Vite, React Router, Leaflet · Node.js + Express 4 · Sequelize 6 on Neon PostgreSQL · Clerk auth · Azure OpenAI · pg-mem for tests · deployed on Render.

## Run it locally

You need Node.js 18+, a PostgreSQL database (Neon works), a Clerk application and an Azure OpenAI deployment.

```bash
git clone https://github.com/suhxnitiwari/ridemanagement.git
cd ridemanagement
cd server && npm install && cp .env.example .env   # fill in the values below
cd ../client && npm install                        # create client/.env with the VITE_* values

cd server && npm run dev    # http://localhost:3001
cd client && npm run dev    # http://localhost:5173, proxies /api to the server
```

Sequelize creates and syncs the tables on first boot. `node seed.js` (in `server/`) resets the database with about 60 sample rides spread over 90 days, so the dashboards have something to show.

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
| GET | `/api/riders/:id` | Admin / self / current driver | Single rider |
| POST | `/api/riders` | Admin | Create rider |
| PUT | `/api/riders/:id` | Any | Update rider |
| DELETE | `/api/riders/:id` | Admin | Soft delete |
| GET | `/api/drivers` | Admin | List drivers (`?search=`) |
| GET | `/api/drivers/me` | Driver | Logged-in user's driver record |
| GET | `/api/drivers/stats` | Admin | Per-driver ride and revenue stats |
| PATCH | `/api/drivers/me/availability` | Driver | Go Available or Offline (`{ available: true }`) |
| GET | `/api/drivers/:id` | Admin / self / current rider | Single driver |
| POST | `/api/drivers` | Admin | Create driver |
| PUT | `/api/drivers/:id` | Driver/Admin | Update driver |
| DELETE | `/api/drivers/:id` | Admin | Soft delete |
| GET | `/api/rides` | Any | Riders see own rows; drivers/admins see all |
| POST | `/api/rides` | Rider | Create ride; `rider_id` resolved server-side from JWT |
| PUT | `/api/rides/:id` | Any (rules below) | Riders cancel; drivers accept → pick up → complete; admins edit anything, incl. the assigned driver |
| PATCH | `/api/rides/:id/status` | Driver/Admin | Status-only update |
| DELETE | `/api/rides/:id` | Admin | Cancel ride |
| GET | `/api/payments` | Any | Own payments (rider) or all (admin) |
| POST | `/api/payments` | Admin | Manual adjustment (fares are billed automatically on completion) |
| PUT | `/api/payments/:id` | Admin | Update payment |
| DELETE | `/api/payments/:id` | Admin | Delete payment |
| POST | `/api/ai/destination-suggestions` | Rider | GPT-4o activity suggestions for a destination |
| POST | `/api/ai/chat` | Any | RideFlow Assistant — multi-turn chat with RideFlow knowledge system prompt |

## Database schema

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

## Ownership

© 2026 Suhani Tiwari. **All rights reserved.** This is my original work. The code is public so you can see how I build, not so you can reuse it: copying, reusing or republishing any part of it, including for a portfolio or a class assignment, is not permitted without my written permission. See [LICENSE](LICENSE).

Built by [Suhani Tiwari](https://suhanitiwari.com).
