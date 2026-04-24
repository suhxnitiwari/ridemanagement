<div align="center">

# 🚗 RideFlow

### A full-stack rideshare platform built for MIS 372T at the University of Texas at Austin

[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)](https://clerk.com)
[![Azure](https://img.shields.io/badge/AI-Azure_OpenAI-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com)
[![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com)

**[Live App →](https://rideflow-frontend.onrender.com)** &nbsp;|&nbsp; **[API →](https://rideflow-server.onrender.com)**

</div>

---

## Overview

RideFlow is a production-grade rideshare web application that connects riders and drivers through a role-based platform. Riders book rides with real-time fare estimation and interactive maps, get AI-powered destination suggestions from Azure OpenAI GPT-4o, and track their full ride and payment history. Drivers manage availability and ride queues. Admins oversee the entire platform with full CRUD capabilities — all from a beautifully designed React frontend backed by a RESTful Express API and a serverless PostgreSQL database hosted on Neon.

Built as a semester capstone for **MIS 372T — Full-Stack Web Application Development** at the University of Texas at Austin, McCombs School of Business.

---

## Live Database Stats

> Numbers pulled live from the production Neon PostgreSQL instance.

| Table | Records |
|---|---|
| 👤 Riders | **12** registered |
| 🚙 Drivers | **11** registered |
| 🗺️ Rides | **62** total |
| 💳 Payments | **48** processed |

**Ride status breakdown:** 48 completed &nbsp;·&nbsp; 8 cancelled &nbsp;·&nbsp; 2 requested &nbsp;·&nbsp; 2 accepted &nbsp;·&nbsp; 1 en route &nbsp;·&nbsp; 1 in progress

---

## Features

### Rider Portal
- **Address Autocomplete** — powered by [Photon by Komoot](https://photon.komoot.io), biased toward Austin, TX (`lat=30.2672, lon=-97.7431`) for fast local results; dropdowns use `position: fixed` + `getBoundingClientRect()` to escape Leaflet's internal z-index stacking context
- **Interactive Route Map** — [Leaflet](https://leafletjs.com) + [OpenStreetMap](https://openstreetmap.org) renders a live driving route between pickup and dropoff using the [OSRM public routing engine](http://project-osrm.org)
- **Real-Time Fare Estimation** — fetches actual driving distance from OSRM, then applies a tiered fare model: base fare + per-mile rate + service fee, with a $5.00 minimum
- **AI Destination Assistant** — enter any dropoff location and click "Suggest things to do" to receive 4–5 curated activity, food, and sightseeing suggestions powered by **Azure OpenAI GPT-4o** (deployment `2024-11-20`); route is protected behind `requireRider` middleware so only authenticated riders can invoke it
- **Strata Chat Widget** — collapsible embedded AI chat assistant (workspace `mis372t`) via iframe for freeform trip questions
- **Ride History** — full table of past rides sorted by most recent, with status badges, fare, date/time, and location data
- **Transaction History** — complete payment ledger with payment method, amount, and status for every completed ride
- **Cancel Ride Flow** — modal with reason selection dropdown and cancellation fee disclosure
- **Dark / Light Theme** — dual-theme design system persisted to `localStorage`, toggle available in the portal navbar

### Driver Portal
- Dedicated driver dashboard with ride management
- Status controls: available, on ride, offline

### Admin Portal
- Full CRUD for riders and drivers via sortable data tables
- Live search with debounced input
- Inline add/edit modals and delete confirmation dialogs
- Toast notification system for every mutation (success + error states)
- Role-restricted — only Clerk users with `admin` or `manager` in `publicMetadata` can access

### Authentication & Authorization
- **Clerk** handles sign-up, sign-in, OAuth, session management, and JWTs
- Three distinct roles enforced on both frontend (`ProtectedRoute` component) and backend (Express middleware): `rider`, `driver`, `admin/manager`
- Tokens auto-refresh every 55 seconds client-side; a fresh token is fetched immediately before each sensitive API call to prevent stale-token 401 failures
- Onboarding page routes new users through role selection before granting portal access

---

## Tech Stack

### Frontend — `client/`

| Technology | Version | Purpose |
|---|---|---|
| [React](https://react.dev) | 18.2 | UI framework |
| [Vite](https://vitejs.dev) | 5.0 | Build tool & dev server with `/api` proxy |
| [React Router DOM](https://reactrouter.com) | 7.14 | Client-side routing |
| [Axios](https://axios-http.com) | 1.6 | HTTP client with global `Authorization` header |
| [Clerk React](https://clerk.com/docs/references/react) | 6.4 | Authentication, session management, role guards |
| [React Leaflet](https://react-leaflet.js.org) | 4.2 | Declarative interactive maps |
| [Leaflet](https://leafletjs.com) | 1.9 | Underlying map engine |
| [Photon by Komoot](https://photon.komoot.io) | — | Address autocomplete, Austin-biased |
| [OSRM](http://project-osrm.org) | — | Real driving route & distance calculation |
| [Nominatim](https://nominatim.org) | — | Geocoding: address string → lat/lon |
| [Strata](https://strata.fyi) | — | Embedded AI chat widget (`workspace=mis372t`) |

### Backend — `server/`

| Technology | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org) + [Express](https://expressjs.com) | 4.18 | REST API server |
| [Sequelize](https://sequelize.org) | 6.35 | ORM — model definitions, associations, migrations via `sync({ alter: true })` |
| [pg](https://node-postgres.com) | 8.11 | PostgreSQL driver (SSL-enforced for Neon) |
| [@clerk/express](https://clerk.com/docs/references/nodejs) | 2.1 | Server-side JWT verification middleware |
| [cors](https://www.npmjs.com/package/cors) | 2.8 | Multi-origin allowlist (comma-separated env var) |
| [dotenv](https://www.npmjs.com/package/dotenv) | 16.3 | Environment variable management |
| [jose](https://www.npmjs.com/package/jose) | 5.9 | JWT utilities |

### Infrastructure

| Service | Purpose |
|---|---|
| [Neon](https://neon.tech) | Serverless PostgreSQL — autoscale, branching, SSL, free tier |
| [Render](https://render.com) | Cloud hosting — frontend (static site) + backend (web service) |
| [Clerk](https://clerk.com) | Auth provider — user management, JWTs, `publicMetadata` roles |
| [Azure AI Foundry](https://ai.azure.com) | GPT-4o deployment (`eastus2` region) for destination suggestions |
| [GitHub](https://github.com) | Version control with push-protection for committed secrets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser  (Vite / React 18)                  │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │  Rider Portal │  │ Driver Portal │  │   Admin Portal     │  │
│  │               │  │               │  │                    │  │
│  │ • Book ride   │  │ • Ride queue  │  │ • Manage riders    │  │
│  │ • Leaflet map │  │ • Status ctrl │  │ • Manage drivers   │  │
│  │ • AI assist   │  │               │  │ • View all rides   │  │
│  │ • Strata chat │  │               │  │                    │  │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬──────────┘  │
│          │                  │                     │             │
│  ┌───────▼──────────────────▼─────────────────────▼──────────┐  │
│  │         Axios  +  Clerk JWT in Authorization header        │  │
│  └──────────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────────┘
                                  │ HTTPS
                    ┌─────────────▼───────────────────┐
                    │   Express API  (Render)          │
                    │                                 │
                    │  clerkMiddleware  (JWT decode)   │
                    │  ─────────────────────────────  │
                    │  /api/auth                       │
                    │  /api/riders    ─┐               │
                    │  /api/drivers   ├── CRUD         │
                    │  /api/rides     │                │
                    │  /api/payments ─┘               │
                    │  /api/ai/destination-suggestions │
                    │          └──► Azure OpenAI       │
                    │               GPT-4o (eastus2)  │
                    └──────────────┬──────────────────┘
                                   │ Sequelize ORM  (SSL)
                    ┌──────────────▼──────────────────┐
                    │      Neon PostgreSQL             │
                    │   (serverless · autoscale)       │
                    │                                 │
                    │  riders (12)   payments (48)     │
                    │  drivers (11)  rides (62)        │
                    └─────────────────────────────────┘
```

---

## Database Schema

Hosted on **[Neon](https://neon.tech)** — a serverless PostgreSQL platform with branching, autoscaling compute, and SSL-enforced connections via `channel_binding=require`. All tables are managed through **Sequelize ORM** with `sync({ alter: true })` on startup — schema changes apply automatically with no data loss.

### `riders` — 12 records
| Column | Type | Notes |
|---|---|---|
| `rider_id` | SERIAL PK | Auto-increment |
| `first_name` | VARCHAR | Not null |
| `last_name` | VARCHAR | Not null |
| `email` | VARCHAR | Unique, email-format validated |
| `phone_number` | VARCHAR | |
| `default_payment_method` | VARCHAR | `credit_card` \| `debit_card` \| `paypal` \| `apple_pay` \| `google_pay` |
| `rating` | DECIMAL(3,2) | 1.00–5.00, default 5.00 |
| `clerk_user_id` | VARCHAR | Unique; links Neon row to Clerk identity |
| `active` | BOOLEAN | Default true |
| `created_at` / `updated_at` | TIMESTAMP | Sequelize auto-managed |

### `drivers` — 11 records
| Column | Type | Notes |
|---|---|---|
| `driver_id` | SERIAL PK | |
| `first_name` / `last_name` | VARCHAR | Not null |
| `email` | VARCHAR | Unique |
| `phone_number` | VARCHAR | |
| `license_plate` | VARCHAR | Unique |
| `vehicle_model` | VARCHAR | |
| `status` | VARCHAR | `available` \| `on_ride` \| `offline` \| `inactive` |
| `rating` | DECIMAL(3,2) | 1.00–5.00, default 5.00 |

### `rides` — 62 records
| Column | Type | Notes |
|---|---|---|
| `ride_id` | SERIAL PK | |
| `rider_id` | INTEGER FK | → `riders.rider_id` |
| `driver_id` | INTEGER FK | → `drivers.driver_id` |
| `pickup_location` | VARCHAR | Free-text address string |
| `dropoff_location` | VARCHAR | Free-text address string |
| `status` | VARCHAR | `requested` \| `accepted` \| `en_route` \| `in_progress` \| `completed` \| `cancelled` |
| `fare` | DECIMAL(8,2) | Calculated client-side via OSRM, stored on booking |

### `payments` — 48 records
| Column | Type | Notes |
|---|---|---|
| `payment_id` | SERIAL PK | |
| `ride_id` | INTEGER FK | → `rides.ride_id` |
| `rider_id` | INTEGER FK | → `riders.rider_id` |
| `amount` | DECIMAL(8,2) | ≥ 0 validated |
| `payment_method` | VARCHAR | Same enum as `riders.default_payment_method` |
| `status` | VARCHAR | `pending` \| `completed` \| `refunded` |

---

## REST API Reference

Base URL: `https://rideflow-server.onrender.com`

All protected routes require a Clerk-issued JWT as `Authorization: Bearer <token>`.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/me` | Any signed-in | Returns current user's profile and role from Clerk |

### Riders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/riders` | Admin / Manager | List all riders; supports `?search=` |
| GET | `/api/riders/:id` | Admin / Manager | Get single rider by ID |
| POST | `/api/riders` | Admin / Manager | Create a new rider record |
| PUT | `/api/riders/:id` | Admin / Manager | Full update |
| DELETE | `/api/riders/:id` | Admin / Manager | Hard delete |

### Drivers
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/drivers` | Any signed-in | List all drivers; supports `?search=` |
| GET | `/api/drivers/stats` | Any signed-in | Aggregate counts by status |
| GET | `/api/drivers/:id` | Any signed-in | Get single driver |
| POST | `/api/drivers` | Admin / Manager | Create driver |
| PUT | `/api/drivers/:id` | Driver / Admin | Update driver |
| DELETE | `/api/drivers/:id` | Admin / Manager | Delete driver |

### Rides
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/rides` | Any signed-in | Riders see own rides; admins see all; supports `?search=`, `?status=`, `?statuses=` |
| GET | `/api/rides/:id` | Any signed-in | Row-level ownership check |
| POST | `/api/rides` | Rider only | Book a ride (auto-links `rider_id` from Clerk JWT) |
| PUT | `/api/rides/:id` | Driver / Admin | Full update |
| PATCH | `/api/rides/:id/status` | Driver / Admin | Status-only update |
| DELETE | `/api/rides/:id` | Admin only | Soft-delete: sets `status = 'cancelled'` |

### Payments
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/payments` | Any signed-in | Own payments (riders) or all (admin) |
| GET | `/api/payments/:id` | Any signed-in | Get single payment |
| POST | `/api/payments` | Rider only | Record a payment |
| PUT | `/api/payments/:id` | Admin only | Update payment record |
| DELETE | `/api/payments/:id` | Admin only | Delete payment |

### AI
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/destination-suggestions` | Rider only | Returns 4–5 plain-text activity/food/sightseeing suggestions for a given destination via Azure OpenAI GPT-4o |

---

## AI Integration — Azure OpenAI

RideFlow's destination assistant is powered by **Azure OpenAI** via Azure AI Foundry. The deployment uses `gpt-4o` (version `2024-11-20`) hosted in the `eastus2` region.

**Request flow:**
```
Rider (browser) → POST /api/ai/destination-suggestions
                         │
                   requireRider middleware
                   (Clerk JWT verified)
                         │
                   aiController.js
                         │
                   POST {AZURE_OPENAI_ENDPOINT}
                        /openai/deployments/gpt-4o
                        /chat/completions
                        ?api-version=2024-10-21
                         │
                   Azure GPT-4o response
                         │
                   JSON { success: true, suggestions: "..." }
                         │
                   Rider portal (right panel)
```

**System prompt design:** The model is instructed to act as a friendly local guide, respond in a plain numbered list (no markdown, no asterisks, no bold), and keep each suggestion to one sentence. Token budget is capped at 400 to keep responses fast.

**Security:** The Azure API key lives exclusively in the server's environment variables — it is never sent to the client. The route is gated behind `requireRider`, which calls `clerkClient.users.getUser(userId)` to verify the `rider` role before forwarding the request to Azure.

---

## Map & Geolocation Stack

| Feature | Provider | Notes |
|---|---|---|
| Map tile rendering | [OpenStreetMap](https://openstreetmap.org) via Leaflet | Free, no API key |
| Address autocomplete | [Photon by Komoot](https://photon.komoot.io) | Komoot's geocoder; biased to Austin TX |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org) | Converts address strings to lat/lon |
| Driving route + distance | [OSRM](http://project-osrm.org) public API | Returns real driving distance in meters and duration in seconds |

**Key implementation detail:** Autocomplete dropdowns use `position: fixed` + `getBoundingClientRect()` to escape Leaflet's internal CSS stacking context. Leaflet creates its own z-index layers (200–600) which would clip standard `position: absolute` dropdowns. By anchoring to the viewport with fixed positioning, dropdowns always render above the map.

---

## Fare Calculation

```
Fare = max(base + distance + service, minimum)

  Base fare:     $2.50  (always applied)
  Distance:      $1.75 × driving miles   (from OSRM real routing)
  Service fee:   $1.20  (when any address is entered)
  Minimum fare:  $5.00
```

Fare is calculated entirely client-side using live OSRM data and stored in the `rides.fare` column when the ride is booked.

---

## Role-Based Access Control

Roles are stored in **Clerk `publicMetadata`** as `{ "role": "rider" | "driver" | "admin" | "manager" }`. Every protected API endpoint calls `clerkClient.users.getUser(userId)` to read the role from the Clerk API — roles are never self-reported by the client.

| Feature | Rider | Driver | Admin / Manager |
|---|---|---|---|
| Book a ride | ✅ | — | — |
| View own rides & history | ✅ | — | — |
| View all rides | — | — | ✅ |
| Update ride status | — | ✅ | ✅ |
| AI destination suggestions | ✅ | — | — |
| View own payments | ✅ | — | — |
| View all payments | — | — | ✅ |
| Full CRUD on riders | — | — | ✅ |
| Full CRUD on drivers | — | — | ✅ |
| Admin portal access | — | — | ✅ |

Frontend `ProtectedRoute` redirects users to `/onboarding` if they have no role, and to the correct portal based on their role.

---

## Neon PostgreSQL

RideFlow's database is hosted on **[Neon](https://neon.tech)** — a modern serverless PostgreSQL platform.

**Why Neon:**
- **Serverless autoscaling** — compute scales to zero when idle; no idle billing on the free tier
- **Database branching** — create isolated database branches for feature development (like Git branches for your schema and data)
- **Instant provisioning** — a new database is ready in seconds
- **SSL-enforced connections** — all connections use `sslmode=require` with `channel_binding=require` for maximum transport security
- **Connection pooling** — handles concurrent connections efficiently without a separate connection pooler

**Connection config in Sequelize:**
```javascript
dialectOptions: {
  ssl: { require: true, rejectUnauthorized: false }
}
```

The production endpoint lives in the `us-east-1` AWS region:
```
ep-red-brook-amyhdn19.c-5.us-east-1.aws.neon.tech
```

Sequelize runs `sync({ alter: true })` on every server startup — this non-destructively updates column definitions to match model changes without dropping tables or data.

---

## Project Structure

```
MIS372T_Rideshare_App/
├── client/                           # React + Vite frontend
│   ├── index.html                    # No external scripts — iframe-only for Strata
│   ├── vite.config.js                # Dev proxy: /api → localhost:3001
│   ├── .env                          # VITE_API_URL, VITE_CLERK_PUBLISHABLE_KEY
│   └── src/
│       ├── main.jsx                  # ClerkProvider, BrowserRouter root
│       ├── App.jsx                   # Routes, AuthSync (55s token refresh), theme toggle
│       ├── index.css                 # Full design system — light + dark themes
│       ├── pages/
│       │   ├── HomePage.jsx          # Landing page
│       │   ├── SignInPage.jsx        # Clerk-hosted sign-in
│       │   ├── SignUpPage.jsx        # Clerk-hosted sign-up
│       │   ├── OnboardingPage.jsx    # Role selection after first sign-in
│       │   ├── RiderPortalPage.jsx   # Book, Active Ride, History, Transactions, Profile
│       │   ├── DriverPortalPage.jsx  # Driver dashboard
│       │   ├── AdminPage.jsx         # Admin dashboard
│       │   └── RidersPage.jsx        # Riders CRUD table (admin only)
│       ├── components/
│       │   ├── Navbar.jsx            # Public site navbar
│       │   ├── PortalNavbar.jsx      # Tabbed portal navbar with theme toggle
│       │   ├── ProtectedRoute.jsx    # Role-based route guard using Clerk
│       │   ├── RideMap.jsx           # Lazy-loaded Leaflet map with route polyline
│       │   ├── RiderForm.jsx         # Add/edit rider modal
│       │   ├── RidersTable.jsx       # Searchable riders table
│       │   ├── DriverForm.jsx        # Add/edit driver modal
│       │   ├── DriversTable.jsx      # Searchable drivers table
│       │   ├── DeleteModal.jsx       # Reusable confirmation dialog
│       │   └── Toast.jsx             # Auto-dismissing notification stack
│       └── services/
│           └── api.js                # Axios instance + ridersApi / driversApi /
│                                     #   ridesApi / paymentsApi / aiApi
│
└── server/                           # Express + Sequelize backend
    ├── index.js                      # App entry: middleware, route registration, DB sync
    ├── .env                          # DATABASE_URL, CLERK keys, AZURE keys (not committed)
    ├── .env.example                  # Template with placeholder values
    ├── config/
    │   └── database.js               # Sequelize + Neon SSL config
    ├── models/
    │   ├── index.js                  # Model associations (Rider→Ride, Driver→Ride, etc.)
    │   ├── Rider.js
    │   ├── Driver.js
    │   ├── Ride.js
    │   └── Payment.js
    ├── routes/
    │   ├── auth.js
    │   ├── riders.js
    │   ├── drivers.js
    │   ├── rides.js
    │   ├── payments.js
    │   └── ai.js
    ├── controllers/
    │   ├── ridersController.js       # Full CRUD + search + row-level auth
    │   ├── driversController.js      # Full CRUD + stats endpoint
    │   ├── ridesController.js        # CRUD + auto rider_id linking + soft delete
    │   ├── paymentsController.js     # CRUD + ownership checks
    │   └── aiController.js           # Azure OpenAI GPT-4o integration
    └── middleware/
        └── requireAuth.js            # requireAuth / requireRider /
                                      #   requireDriver / requireAdmin
```

---

## Getting Started Locally

### Prerequisites

- Node.js ≥ 18
- A [Clerk](https://clerk.com) account (free tier)
- A [Neon](https://neon.tech) PostgreSQL database (free tier)
- An [Azure](https://portal.azure.com) account with an OpenAI resource and `gpt-4o` deployment

### 1. Clone

```bash
git clone https://github.com/suhanitiwari0306/MIS372T_Rideshare_App.git
cd MIS372T_Rideshare_App
```

### 2. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configure environment variables

**`server/.env`**
```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require
DB_SSL=true
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
CLERK_SECRET_KEY=sk_test_...
AZURE_AI_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:3001/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 4. Run

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Vite automatically proxies all `/api/*` requests to `localhost:3001` in development (configured in `vite.config.js`), so no CORS setup is needed locally.

---

## Deployment (Render)

Both services are deployed on **[Render](https://render.com)**.

| Service | Type | URL |
|---|---|---|
| `rideflow-server` | Web Service (Node.js) | `https://rideflow-server.onrender.com` |
| `rideflow-frontend` | Static Site | `https://rideflow-frontend.onrender.com` |

**Backend environment variables** (set in Render dashboard):
```
DATABASE_URL            — Neon connection string (with SSL params)
CLIENT_ORIGIN           — https://rideflow-frontend.onrender.com
CLERK_SECRET_KEY        — Clerk backend secret key
AZURE_AI_KEY            — Azure OpenAI API key
AZURE_OPENAI_ENDPOINT   — https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT — gpt-4o
```

**Frontend environment variables** (set in Render dashboard):
```
VITE_API_URL                — https://rideflow-server.onrender.com/api
VITE_CLERK_PUBLISHABLE_KEY  — pk_live_...
```

> **Note on Render free tier:** Web services spin down after 15 minutes of inactivity. The first request after a cold start may take 30–60 seconds. Subsequent requests within the active window are fast. The CORS configuration supports multiple comma-separated origins in `CLIENT_ORIGIN` for flexible deployment.

---

## Design System

RideFlow ships a full dual-theme CSS design system in `client/src/index.css`:

**Dark theme** (default)
- Background: `#0c000f` (near-black deep purple)
- Surface: `#1c0035` (dark purple)
- Accent: `#ae02a0` (magenta)
- Text: `#eaa0ff` / `#c06ed4`

**Light theme**
- Background: `#fdf5ff` (near-white lavender)
- Surface: `#ffffff`
- Same magenta accent `#ae02a0`
- Text: `#0c000f` / `#4a0f62`

Theme preference is persisted to `localStorage` and applied via `data-theme` attribute on `<html>`. The toggle is visible in all portal navbars and the public Navbar component.

---

## Assignment Requirements

Built to satisfy **MIS 372T Spring 2026** project requirements:

| Requirement | Implementation |
|---|---|
| React frontend with component architecture | ✅ React 18 + Vite, `components/` and `pages/` separation |
| External CSS design system | ✅ Full `index.css` with CSS custom properties (no inline styles in components) |
| Node.js + Express REST API | ✅ 6 route files, 5 controllers, full CRUD |
| Sequelize ORM + PostgreSQL | ✅ 4 models with validations, associations, `sync({ alter: true })` |
| Neon hosted database | ✅ Production DB on Neon (`us-east-1`), 62+ rides, 12 riders, 11 drivers |
| Clerk authentication with roles | ✅ `rider`, `driver`, `admin/manager` enforced on both frontend and backend |
| LLM integration via Azure AI Foundry | ✅ GPT-4o (`gpt-4o`, deployment `2024-11-20`) for destination suggestions |
| Strata platform chat widget | ✅ Embedded via iframe (`workspace=mis372t`), collapsible UI |
| Interactive maps | ✅ Leaflet + OpenStreetMap + OSRM routing + Photon autocomplete |
| Cloud deployment | ✅ Both services live on Render |
| Role-based route protection | ✅ `ProtectedRoute` (frontend) + `requireAuth/Rider/Driver/Admin` (backend) |

---

## Author

**Suhani Tiwari**  
MIS 372T · McCombs School of Business · The University of Texas at Austin  
[github.com/suhanitiwari0306](https://github.com/suhanitiwari0306)

---

<div align="center">

Built with React · Express · Neon PostgreSQL · Clerk · Azure OpenAI · Leaflet · Render

</div>
