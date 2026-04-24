# RideFlow

A role-based rideshare platform — React frontend, Node/Express REST API, PostgreSQL on Neon, Clerk authentication, Azure OpenAI GPT-4o, and Leaflet maps. Deployed on Render.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18.2-blue?style=flat-square)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/postgres-neon-blue?style=flat-square)](https://neon.tech)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**Production:** [rideflow-frontend.onrender.com](https://rideflow-frontend.onrender.com) &nbsp;·&nbsp; **API:** [rideflow-server.onrender.com](https://rideflow-server.onrender.com)

---

## Table of Contents

- [Overview](#overview)
- [Production Database Snapshot](#production-database-snapshot)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Feature Breakdown](#feature-breakdown)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Authentication & Authorization](#authentication--authorization)
- [AI Integration](#ai-integration)
- [Maps & Geocoding](#maps--geocoding)
- [Fare Model](#fare-model)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Design System](#design-system)

---

## Overview

RideFlow is a multi-portal rideshare application with three distinct authenticated roles: **riders**, **drivers**, and **admins**. Each role is issued a Clerk-signed JWT containing a role claim that is verified independently on every API request — the client never has authority over its own permissions.

Riders can book rides with real-time fare estimation derived from actual driving distance (OSRM), visualized on an interactive Leaflet map with Photon-powered address autocomplete. An Azure OpenAI GPT-4o endpoint, gated behind server-side role verification, provides destination activity suggestions. Admins manage the full rider and driver roster through a live CRUD interface backed by a Neon-hosted PostgreSQL database accessed via Sequelize ORM.

---

## Production Database Snapshot

> Live counts from the Neon PostgreSQL instance at time of last README update.

| Entity | Count |
|---|---|
| Riders | 12 |
| Drivers | 11 |
| Rides | 62 |
| Payments processed | 48 |

**Ride status distribution**

| Status | Count |
|---|---|
| completed | 48 |
| cancelled | 8 |
| requested | 2 |
| accepted | 2 |
| en_route | 1 |
| in_progress | 1 |

---

## Architecture

```
                           ┌──────────────────────────────────────┐
                           │            Render (static)            │
                           │         React 18 + Vite 5.0           │
                           │                                       │
                           │  /              → HomePage            │
                           │  /sign-in       → Clerk-hosted        │
                           │  /onboarding    → role selection      │
                           │  /rider         → RiderPortalPage     │
                           │  /driver        → DriverPortalPage    │
                           │  /admin         → AdminPage           │
                           └──────────────────┬────────────────────┘
                                              │
                                     Axios + Bearer JWT
                                     (refreshed every 55s
                                      + on each sensitive call)
                                              │
                           ┌──────────────────▼────────────────────┐
                           │            Render (web service)        │
                           │        Node.js 18 + Express 4.18       │
                           │                                       │
                           │  clerkMiddleware  ← JWT decode        │
                           │  CORS allowlist   ← env-configured    │
                           │                                       │
                           │  /api/auth          requireAuth       │
                           │  /api/riders        requireAdmin      │
                           │  /api/drivers       requireAdmin      │
                           │  /api/rides         requireRider /    │
                           │                     requireDriver     │
                           │  /api/payments      requireRider      │
                           │  /api/ai/…          requireRider ──── │──► Azure OpenAI
                           └──────────────────┬────────────────────┘    GPT-4o (eastus2)
                                              │
                                   Sequelize ORM · SSL
                                              │
                           ┌──────────────────▼────────────────────┐
                           │           Neon PostgreSQL              │
                           │   Serverless · us-east-1 · autoscale   │
                           │                                       │
                           │   riders      drivers                 │
                           │   rides       payments                │
                           └────────────────────────────────────────┘
```

External services called from the **browser** (no API key required):

| Service | Purpose |
|---|---|
| Photon (Komoot) | Address autocomplete |
| Nominatim (OSM) | Forward geocoding |
| OSRM (public) | Driving route + distance |
| OpenStreetMap tiles | Leaflet map rendering |
| Strata (`mis372t`) | Embedded AI chat widget |

---

## Tech Stack

### Client

| Package | Version | Role |
|---|---|---|
| react | 18.2 | UI framework |
| react-dom | 18.2 | DOM renderer |
| react-router-dom | 7.14 | Client-side routing |
| @clerk/react | 6.4 | Auth hooks, session management |
| axios | 1.6 | HTTP client; global `Authorization` header via `setAuthToken` |
| leaflet | 1.9 | Map engine |
| react-leaflet | 4.2 | Declarative Leaflet bindings |
| vite | 5.0 | Build tool; dev-server proxy for `/api` |

### Server

| Package | Version | Role |
|---|---|---|
| express | 4.18 | HTTP server and router |
| sequelize | 6.35 | ORM; model definitions, associations, `sync({ alter: true })` |
| pg / pg-hstore | 8.11 | PostgreSQL dialect + hstore serialization |
| @clerk/express | 2.1 | `clerkMiddleware`, `getAuth`, `clerkClient` for server-side JWT handling |
| cors | 2.8 | Origin allowlist; supports comma-separated `CLIENT_ORIGIN` |
| dotenv | 16.3 | Environment variable loading |
| jose | 5.9 | JWT utilities |

### Infrastructure

| Service | Plan | Purpose |
|---|---|---|
| [Neon](https://neon.tech) | Free tier | Serverless PostgreSQL — autoscale, branching, SSL |
| [Render](https://render.com) | Free tier | Frontend (static site) + backend (web service) |
| [Clerk](https://clerk.com) | Free tier | Auth provider — JWTs, `publicMetadata` role storage |
| [Azure AI Foundry](https://ai.azure.com) | Pay-as-you-go | GPT-4o deployment, `eastus2` region |

---

## Feature Breakdown

### Rider Portal

**Ride booking**
- Pickup and dropoff inputs with Photon-powered autocomplete, geo-biased to Austin TX (`lat=30.2672, lon=-97.7431`)
- Dropdowns rendered via `position: fixed` + `getBoundingClientRect()` to escape Leaflet's internal z-index stacking context (Leaflet creates pane layers at z-index 200–600)
- Coordinates resolved via Nominatim forward geocoding; route fetched from OSRM `/route/v1/driving/` to obtain real driving distance in meters and duration in seconds
- Fare breakdown rendered in real-time as addresses are entered
- Clerk token is explicitly refreshed via `getToken()` immediately before each POST to prevent stale-JWT 401s between the 55-second auto-refresh cycles

**AI destination assistant**
- On demand: rider enters a dropoff, clicks "Suggest things to do"
- POST to `/api/ai/destination-suggestions` — verified by `requireRider` middleware before forwarding to Azure OpenAI
- Response is plain-text numbered list (no markdown); prompt explicitly instructs the model to omit asterisks, bold, and other formatting

**History & transactions**
- Ride history table: sorted by `created_at DESC`, with status badges, fare, and formatted timestamps
- Transactions table: payment method, amount, and status for every linked payment record

**Strata chat**
- Embedded via `<iframe src="https://strata.fyi/embed?workspace=mis372t">`, collapsed by default
- Strata's embed stylesheet (`widget.css`) is intentionally **not** loaded in `index.html` — it injects a full-page fixed overlay that blocks all pointer events on the parent document

### Admin Portal

- Full CRUD for `riders` and `drivers` tables via data tables with debounced search
- Add/edit via modal forms with client-side validation
- Soft-delete confirmation dialogs
- Toast notification stack for all async operations
- Access requires `role: admin` or `role: manager` in Clerk `publicMetadata`

### Authentication

- Clerk handles sign-up, sign-in, and OAuth flows
- After sign-up, users are routed to `/onboarding` where they select a role; that role is written to Clerk `publicMetadata` and persists across sessions
- `ProtectedRoute` component reads role from Clerk and redirects unauthorized access
- `AuthSync` component runs in `App.jsx`, refreshes the Clerk token every 55 seconds via `getToken({ skipCache: false })`, and updates the global Axios `Authorization` header

---

## Database Schema

All tables managed by Sequelize on **Neon PostgreSQL**. Schema changes are applied non-destructively via `sync({ alter: true })` on every server start.

### `riders`

```sql
CREATE TABLE riders (
  rider_id               SERIAL PRIMARY KEY,
  first_name             VARCHAR NOT NULL,
  last_name              VARCHAR NOT NULL,
  email                  VARCHAR NOT NULL UNIQUE,
  phone_number           VARCHAR NOT NULL,
  default_payment_method VARCHAR NOT NULL DEFAULT 'credit_card'
                         CHECK (default_payment_method IN
                           ('credit_card','debit_card','paypal','apple_pay','google_pay')),
  rating                 DECIMAL(3,2) DEFAULT 5.00
                         CHECK (rating BETWEEN 1.00 AND 5.00),
  clerk_user_id          VARCHAR UNIQUE,
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ
);
```

### `drivers`

```sql
CREATE TABLE drivers (
  driver_id     SERIAL PRIMARY KEY,
  first_name    VARCHAR NOT NULL,
  last_name     VARCHAR NOT NULL,
  email         VARCHAR NOT NULL UNIQUE,
  phone_number  VARCHAR NOT NULL,
  license_plate VARCHAR NOT NULL UNIQUE,
  vehicle_model VARCHAR NOT NULL,
  status        VARCHAR NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','on_ride','offline','inactive')),
  rating        DECIMAL(3,2) DEFAULT 5.00
                CHECK (rating BETWEEN 1.00 AND 5.00),
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
);
```

### `rides`

```sql
CREATE TABLE rides (
  ride_id          SERIAL PRIMARY KEY,
  rider_id         INTEGER REFERENCES riders(rider_id),
  driver_id        INTEGER REFERENCES drivers(driver_id),
  pickup_location  VARCHAR NOT NULL,
  dropoff_location VARCHAR NOT NULL,
  status           VARCHAR NOT NULL DEFAULT 'requested'
                   CHECK (status IN
                     ('requested','accepted','en_route','in_progress','completed','cancelled')),
  fare             DECIMAL(8,2),
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
);
```

### `payments`

```sql
CREATE TABLE payments (
  payment_id     SERIAL PRIMARY KEY,
  ride_id        INTEGER NOT NULL REFERENCES rides(ride_id),
  rider_id       INTEGER REFERENCES riders(rider_id),
  amount         DECIMAL(8,2) NOT NULL CHECK (amount >= 0),
  payment_method VARCHAR NOT NULL DEFAULT 'credit_card'
                 CHECK (payment_method IN
                   ('credit_card','debit_card','paypal','apple_pay','google_pay')),
  status         VARCHAR NOT NULL DEFAULT 'completed'
                 CHECK (status IN ('pending','completed','refunded')),
  created_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ
);
```

---

## API Reference

Base URL: `https://rideflow-server.onrender.com`

All protected endpoints require `Authorization: Bearer <clerk-jwt>`.

### `GET /`

Health check. Returns `{ message, version }`. No auth required.

---

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/me` | Signed in | Current user's Clerk profile and role |

---

### Riders — `/api/riders`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/riders` | Admin | List all riders. Supports `?search=` (name or email, case-insensitive) |
| GET | `/api/riders/:id` | Admin | Single rider by primary key |
| POST | `/api/riders` | Admin | Create rider. Required: `first_name`, `last_name`, `email`, `phone_number` |
| PUT | `/api/riders/:id` | Admin | Full update |
| DELETE | `/api/riders/:id` | Admin | Hard delete |

---

### Drivers — `/api/drivers`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/drivers` | Signed in | List all drivers. Supports `?search=` |
| GET | `/api/drivers/stats` | Signed in | Count by status (`available`, `on_ride`, `offline`, `inactive`) |
| GET | `/api/drivers/:id` | Signed in | Single driver |
| POST | `/api/drivers` | Admin | Create driver. Required: `first_name`, `last_name`, `email`, `phone_number`, `license_plate`, `vehicle_model` |
| PUT | `/api/drivers/:id` | Driver / Admin | Update fields |
| DELETE | `/api/drivers/:id` | Admin | Delete |

---

### Rides — `/api/rides`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rides` | Signed in | Riders receive only their own rows (filtered by `clerk_user_id → rider_id`); admins receive all rows. Supports `?search=`, `?status=`, `?statuses=a,b` |
| GET | `/api/rides/:id` | Signed in | Single ride; row-level ownership enforced for non-admins |
| POST | `/api/rides` | Rider | Create ride. Required: `pickup_location`, `dropoff_location`. Optional: `fare`, `driver_id`. `rider_id` is resolved server-side from the JWT |
| PUT | `/api/rides/:id` | Driver / Admin | Full update |
| PATCH | `/api/rides/:id/status` | Driver / Admin | Status-only update. Validates against enum: `requested`, `accepted`, `en_route`, `in_progress`, `completed`, `cancelled` |
| DELETE | `/api/rides/:id` | Admin | Soft delete — sets `status = 'cancelled'` |

---

### Payments — `/api/payments`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/payments` | Signed in | Own payments (rider) or all (admin) |
| GET | `/api/payments/:id` | Signed in | Single payment with ownership check |
| POST | `/api/payments` | Rider | Create payment record. Required: `ride_id`, `amount`, `payment_method` |
| PUT | `/api/payments/:id` | Admin | Update |
| DELETE | `/api/payments/:id` | Admin | Delete |

---

### AI — `/api/ai`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/ai/destination-suggestions` | Rider | `{ destination: string }` | Returns 4–5 plain-text activity suggestions for the given location via Azure OpenAI GPT-4o |

**Response**
```json
{
  "success": true,
  "suggestions": "1. Visit the Texas State Capitol...\n2. ..."
}
```

---

## Authentication & Authorization

Roles are stored in **Clerk `publicMetadata`** and are write-protected — only server-side Clerk SDK calls (with the secret key) can modify them. The client cannot self-assign a role.

```
publicMetadata: { "role": "rider" | "driver" | "admin" | "manager" }
```

**Middleware chain (server)**

```
Request
  └─► clerkMiddleware()          — decodes JWT, attaches userId to req
        └─► requireAuth()        — rejects if no userId
              └─► requireRider() — calls clerkClient.users.getUser(userId)
                                   rejects if role !== 'rider' | 'admin' | 'manager'
```

Each middleware variant (`requireRider`, `requireDriver`, `requireAdmin`) independently fetches the user from Clerk on every request — the role is never trusted from the token payload alone.

**Client-side token lifecycle**

```
App mounts
  └─► AuthSync useEffect
        ├─► getToken() → setAuthToken(token)   (immediate)
        └─► setInterval(55_000)                (refresh loop)
              └─► getToken() → setAuthToken(token)

handleBookRide / handleGetSuggestions
  └─► getToken() → setAuthToken(token)         (pre-call refresh)
        └─► ridesApi.create(...) / aiApi.getDestinationSuggestions(...)
```

**Access matrix**

| Endpoint group | Rider | Driver | Admin / Manager |
|---|---|---|---|
| `POST /api/rides` | ✓ | — | — |
| `GET /api/rides` (own) | ✓ | — | — |
| `GET /api/rides` (all) | — | — | ✓ |
| `PATCH /api/rides/:id/status` | — | ✓ | ✓ |
| `POST /api/ai/destination-suggestions` | ✓ | — | — |
| `GET /api/payments` (own) | ✓ | — | — |
| `GET/POST/PUT/DELETE /api/riders` | — | — | ✓ |
| `GET/POST/PUT/DELETE /api/drivers` | — | — | ✓ |

---

## AI Integration

RideFlow calls the **Azure OpenAI** service via Azure AI Foundry. Deployment details:

| Parameter | Value |
|---|---|
| Deployment name | `gpt-4o` |
| Model version | `2024-11-20` |
| Region | `eastus2` |
| API version | `2024-10-21` |
| Max tokens | 400 |
| Temperature | 0.7 |

**Endpoint pattern**
```
POST {AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21
Headers:
  Content-Type: application/json
  api-key: {AZURE_AI_KEY}
```

**System prompt**
```
You are a friendly local guide. Give concise, useful suggestions.
Use plain text only — no asterisks, no bold, no markdown.
```

**User prompt template**
```
I'm taking a rideshare to "{destination}". Suggest 4-5 fun things to do,
see, or eat near this destination. Keep each item to one short sentence.
Format as a plain numbered list with no special formatting.
```

The Azure API key is stored exclusively in the server environment. It is never forwarded to the client or logged.

---

## Maps & Geocoding

| Capability | Provider | Notes |
|---|---|---|
| Tile rendering | OpenStreetMap via Leaflet | No API key required |
| Address autocomplete | [Photon by Komoot](https://photon.komoot.io) | `?q=&limit=5&lang=en&lat=30.2672&lon=-97.7431` |
| Forward geocoding | [Nominatim](https://nominatim.openstreetmap.org) | `?format=json&q=...&limit=1` |
| Driving route | [OSRM public API](http://project-osrm.org) | `/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false` |

**Autocomplete z-index solution**

Leaflet mounts its tile and marker panes at z-indices 200–600 inside a positioned container, creating a stacking context that clips any child `position: absolute` dropdown. The autocomplete dropdown uses `position: fixed` anchored via `getBoundingClientRect()` on the input element:

```javascript
onChange={(e) => {
  setPickup(e.target.value);
  if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
}}

// Dropdown
<div style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width }}>
```

This renders the dropdown at viewport level, unaffected by any ancestor stacking context.

**Selection suppression**

A `useRef` flag (`pickupSelected`) prevents the geocoding `useEffect` from firing a redundant search cycle immediately after a suggestion is selected:

```javascript
useEffect(() => {
  if (pickupSelected.current) { pickupSelected.current = false; return; }
  // debounced geocode + autocomplete search
}, [pickup]);
```

---

## Fare Model

```
fare = max(baseFare + distanceFare + serviceFee, minimumFare)

  baseFare     = $2.50   (fixed, always applied)
  distanceFare = $1.75 × miles  (miles = OSRM distance_meters / 1609.34)
  serviceFee   = $1.20   (applied when any address field is non-empty)
  minimumFare  = $5.00
```

Fare is computed client-side from live OSRM data and transmitted in the `POST /api/rides` body, where it is stored as `DECIMAL(8,2)` in the `rides` table.

---

## Project Structure

```
.
├── client/
│   ├── index.html
│   ├── vite.config.js              # dev proxy: /api → http://localhost:3001
│   ├── .env                        # VITE_API_URL, VITE_CLERK_PUBLISHABLE_KEY
│   └── src/
│       ├── main.jsx                # ClerkProvider wraps BrowserRouter
│       ├── App.jsx                 # Route tree, AuthSync, theme state
│       ├── index.css               # CSS custom properties — light + dark themes
│       ├── pages/
│       │   ├── HomePage.jsx
│       │   ├── SignInPage.jsx
│       │   ├── SignUpPage.jsx
│       │   ├── OnboardingPage.jsx  # Role selection; writes to Clerk publicMetadata
│       │   ├── RiderPortalPage.jsx # Book, Active, History, Transactions, Profile tabs
│       │   ├── DriverPortalPage.jsx
│       │   ├── AdminPage.jsx
│       │   └── RidersPage.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── PortalNavbar.jsx
│       │   ├── ProtectedRoute.jsx  # Reads Clerk role; redirects on mismatch
│       │   ├── RideMap.jsx         # Lazy-loaded; renders route polyline via OSRM coords
│       │   ├── RiderForm.jsx
│       │   ├── RidersTable.jsx
│       │   ├── DriverForm.jsx
│       │   ├── DriversTable.jsx
│       │   ├── DeleteModal.jsx
│       │   └── Toast.jsx
│       └── services/
│           └── api.js              # Axios instance; ridersApi driversApi ridesApi
│                                   # paymentsApi aiApi; setAuthToken export
│
└── server/
    ├── index.js                    # Express setup, middleware registration, DB sync
    ├── .env.example
    ├── config/
    │   └── database.js             # Sequelize + pg SSL config for Neon
    ├── models/
    │   ├── index.js                # hasMany / belongsTo associations
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
    │   ├── ridersController.js
    │   ├── driversController.js
    │   ├── ridesController.js      # Resolves rider_id from JWT on POST
    │   ├── paymentsController.js
    │   └── aiController.js         # Azure OpenAI fetch; never exposes key to client
    └── middleware/
        └── requireAuth.js          # requireAuth requireRider requireDriver requireAdmin
```

---

## Local Development

**Prerequisites:** Node.js ≥ 18, a Neon (or any PostgreSQL) database, Clerk application, Azure OpenAI deployment.

```bash
git clone https://github.com/suhanitiwari0306/MIS372T_Rideshare_App.git
cd MIS372T_Rideshare_App

# Install dependencies
cd server && npm install && cd ../client && npm install

# Configure environment (see next section)
cp server/.env.example server/.env
# edit server/.env with your credentials

# Start backend
cd server && npm run dev        # http://localhost:3001

# Start frontend (separate terminal)
cd client && npm run dev        # http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to `localhost:3001`. No CORS configuration is needed locally.

Sequelize will create and sync all tables on first startup via `sync({ alter: true })`.

---

## Environment Variables

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full Neon connection string including `?sslmode=require&channel_binding=require` |
| `DB_SSL` | Yes | Set to `true` for Neon / any SSL-required host |
| `PORT` | No | Server port. Defaults to `3001` |
| `CLIENT_ORIGIN` | Yes | Comma-separated list of allowed CORS origins (e.g. `http://localhost:5173,https://rideflow-frontend.onrender.com`) |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key (`sk_live_…` or `sk_test_…`) |
| `AZURE_AI_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | No | Deployment name. Defaults to `gpt-4o` |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full API base URL, e.g. `https://rideflow-server.onrender.com/api`. Falls back to `/api` (Vite proxy) if unset |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_live_…` or `pk_test_…`) |

---

## Deployment

Both services run on [Render](https://render.com) free tier.

**Backend — Web Service**

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `cd server && npm install` |
| Start command | `cd server && node index.js` |
| Root directory | *(repo root)* |

Set all variables from `server/.env` in the Render environment variable panel. Do **not** commit `.env` to the repository.

**Frontend — Static Site**

| Setting | Value |
|---|---|
| Build command | `cd client && npm install && npm run build` |
| Publish directory | `client/dist` |
| Root directory | *(repo root)* |

Set `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` in the Render environment variable panel. Vite inlines `VITE_*` variables at build time — changes require a redeploy.

**Cold-start behaviour:** Render free-tier web services shut down after 15 minutes of inactivity. The first inbound request after a sleep period can take 30–60 seconds while the container boots. The application handles this gracefully — network errors surface a visible banner prompting the user to retry in 30 seconds.

---

## Design System

`client/src/index.css` implements a two-theme design system via CSS custom properties on `:root` (dark, default) and `[data-theme="light"]`.

| Token | Dark | Light |
|---|---|---|
| `--bg-primary` | `#0c000f` | `#fdf5ff` |
| `--bg-card` | `#1c0035` | `#ffffff` |
| `--magenta` | `#ae02a0` | `#ae02a0` |
| `--text-primary` | `#eaa0ff` | `#0c000f` |
| `--text-muted` | `#7a3d8a` | `#7a3d8a` |
| `--danger` | `#ff3d6e` | `#dc2626` |

Theme preference is written to `localStorage` under the key `rideflow-theme` and re-applied via `document.documentElement.setAttribute('data-theme', theme)` on mount and on toggle.

---

## Course Context

**University:** The University of Texas at Austin, McCombs School of Business  
**Course:** MIS 372T — Full-Stack Web Application Development, Spring 2026  
**Author:** Suhani Tiwari · [github.com/suhanitiwari0306](https://github.com/suhanitiwari0306)
