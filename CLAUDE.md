# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## System Overview

This is the **Velish** campus cafeteria food ordering platform, consisting of four interconnected projects:

| Project | Type | Role |
|---------|------|------|
| `booking_backend` | Node.js/Express API | Central backend for all clients |
| `Booking_System` | Flutter (user app) | Customer-facing mobile app |
| `Booking_Admin` | Flutter (admin app) | Cafeteria staff/admin mobile app |
| `Ownerwebsite` | React/TypeScript SPA | Super admin web dashboard |

All three frontends connect to the same backend at `https://api.velish.in` (or `localhost:4000` in dev).

---

## booking_backend (Node.js/Express)

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (hot reload) on port 4000
npm start            # Start for production
```

Environment files: `.env.local` (development), `.env.production`, `.env.test`. The server loads dotenv before anything else.

**E2E / load tests** live in separate directories and are not part of the main app:
```bash
cd api_automation_testing && npm test   # Playwright API tests
# Load testing: locustfile.py (Python/Locust)
```

No linter is configured — add `eslint` as a dev dependency if needed.

### Architecture

**Pattern:** MVC with a clear layered request flow:
```
Request → CORS/Rate-limit → Auth middleware (JWT) → Route → Controller → Model → Response
```

**Entry points:**
- `src/server.js` — loads env, creates HTTP + Socket.IO servers, syncs DB if `DB_SYNC=true`
- `src/app.js` — Express app wiring: CORS, rate limiting, routes, Swagger at `/api-docs`

**Key directories:**
- `src/models/` — 28 Sequelize models. Associations are defined centrally (User→Orders→OrderItems→MenuItems, Cafeteria→MenuItems/Orders/Vendors, Order→Payments/UpiPayments)
- `src/controllers/` — business logic, ~25 controllers
- `src/routes/` — Express routers, ~20 files
- `src/middleware/` — JWT auth (user vs. admin use different secrets), role guards, webhook API key verification
- `src/utils/` — Redis cache helpers, Winston logger, Google Sheets integration
- `src/cron/` — Scheduled jobs (runs every 15s): sends FCM reminders at 10 min left, auto-expires orders at 20 min, syncs Google Sheets
- `src/socket.js` — emits `NEW_ORDER` to `cafeteria_{id}` rooms and `ORDER_STATUS_UPDATE` to `user_{id}` rooms

**Authentication:**
- User JWT: `JWT_SECRET`, cached in Redis for 5 min (avoids DB hit per request)
- Admin JWT: `SUPERADMIN_JWT_SECRET` (separate secret)
- Webhook: API key in request header via `WEBHOOK_API_KEY`
- Cache is cleared on logout/user deletion via `clearAuthCache()`

**Redis caching TTLs:**
- Auth: 5 min | Menu: 1 min | Cafeteria: 5 min | Analytics: 15 sec

**Payment flow:** Cashfree payment gateway → webhook updates order status → vendor split via `Commission` model. Bill IDs are `{cafeteriaPrefix}{randomSuffix}` with daily per-cafeteria order numbering.

**Concurrency:** Sequelize transactions + row-level locking (`UPDATE` lock, `skipLocked`) protect order creation and notification scheduling.

**Standard API response shape:**
```js
{ success: true|false, message: "...", data: {...} }
```

**Rate limits:** 1000 req/min (general), 100 req/min (payment endpoints). Disable with `ENABLE_RATE_LIMIT=false`.

**Health endpoints:** `GET /` and `GET /api/health`

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (SSL required) |
| `JWT_SECRET` | User/Admin token signing |
| `SUPERADMIN_JWT_SECRET` | Superadmin token signing |
| `REDIS_URL` | Redis connection |
| `PORT` | Default 4000 |
| `NODE_ENV` | `development` / `production` / `test` |
| `CASHFREE_SANDBOX_CLIENT_ID` / `_SECRET` | Payment gateway |
| `AWS_REGION`, `AWS_S3_BUCKET_NAME` | File uploads |
| `FIREBASE_PROJECT_ID` | FCM notifications |
| `WEBHOOK_API_KEY` | Internal webhook verification |
| `DB_SYNC` | Auto-sync Sequelize models on startup (default `false`) |

**Database:** PostgreSQL via Sequelize v6, connection pool max 10, SSL with `rejectUnauthorized: false`. Models are synced on startup only when `DB_SYNC=true`; prefer migrations in `/migrations/` otherwise.

---

## Booking_Admin (Flutter — Admin Mobile App)

### Commands

```bash
flutter pub get
flutter run                                    # Debug on connected device
flutter run --dart-define=API_BASE_URL=https://api.velish.in
flutter build apk                              # Android release
flutter build appbundle                        # Play Store bundle
flutter analyze                                # Lint (flutter_lints)
flutter test                                   # Tests (minimal coverage exists)
```

### Architecture

**Auth gate flow:** `SplashVideoScreen` → `AuthGate` (checks JWT + optional biometrics) → `MainShell` (4-tab IndexedStack: Dashboard / Menu / Live Orders / Settings)

**Services** (`lib/services/`):
- `api_client.dart` — HTTP with automatic token refresh on 401 and retry on connection reset
- `printer_service.dart` — Bluetooth (BLE) or WiFi (TCP/IP) thermal printer with in-memory + SharedPreferences-persisted queue; tracks printed orders to prevent duplicates
- `secure_token_service.dart` — JWT in `flutter_secure_storage` (migrated from SharedPreferences)
- `invoice_service.dart` — On-device PDF generation

**Real-time:** Socket.IO via `lib/realtime/socket_service.dart` — joins cafeteria room, receives `NEW_ORDER` events, reconnects with 1–5s exponential backoff.

**Notifications:** FCM + local notifications with custom sound (`new_order.mp3`); high-priority Android channel.

**Environment variables** (via `--dart-define`):
- `API_BASE_URL` (default: `https://api.velish.in`)
- `ENVIRONMENT` (default: `production`)
- `ENABLE_DEBUG_LOGS` (default: `false`)

---

## Booking_System (Flutter — Customer Mobile App)

### Commands

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=https://api.velish.in
flutter build apk
flutter analyze
flutter test
```

Keystore generation: `./generate_keystore.sh`
Firebase SHA: `./get_app_sha.sh`

### Architecture

**Flow:** `SplashVideoScreen` → Login/Register → `HomeScreen` (cafeteria list + menu) → `CartPage` → Checkout → `BookingConfirmed`

**Global state:** `GlobalCart` (static properties + `ValueNotifier`) for cart across screens. No Riverpod/Bloc — stateful widgets call services directly.

**Services** (`lib/services/`):
- `api_client.dart` — 5 retries with exponential backoff (500ms → 12s) + jitter; health-checks `/api/health` every 10s
- `geofencing_service.dart` — Polls location every 30s, notifies user when within 500m of a cafeteria (spam prevention via per-cafeteria tracking)
- `upi_payment_service.dart` — UPI intent payments + Cashfree SDK integration
- `menu_cache_service.dart` — Offline menu caching

**Authentication:** Firebase Auth (email/Google/Apple Sign-In) + backend JWT stored in `flutter_secure_storage`.

**Real-time:** Socket.IO for order status updates + FCM push notifications.

**Same `--dart-define` env vars** as Booking_Admin.

---

## Ownerwebsite (React + TypeScript — Super Admin Dashboard)

### Commands

```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build → dist/
npm run lint      # ESLint (flat config, TypeScript + React Hooks rules)
npm run preview   # Serve production build locally
```

### Architecture

**Providers (nested in `App.tsx`):** `QueryClientProvider` → `ThemeProvider` (MUI dark purple) → `AuthProvider` → `CafeteriaProvider`

**Two operating modes** controlled by `CafeteriaContext`:
- **Global mode** (no cafeteria selected) → uses `/api/superadmin/` endpoints, sees all cafeterias
- **Scoped mode** (cafeteria selected) → uses `/api/admin/` endpoints, sees one cafeteria

**Key directories:**
- `src/api/` — Service layer: `client.ts` (Axios instance), one file per entity. The Axios instance injects `Authorization: Bearer` from `localStorage` (`superadmin_token`) and redirects to login on 401.
- `src/context/` — `AuthContext.tsx` (login/logout, token persistence), `CafeteriaContext.tsx` (selected cafeteria, mode switching)
- `src/pages/analytics/` — Revenue, Order, Customer, and Advanced analytics pages, all using Recharts
- `src/theme/` — Premium dark purple MUI theme with glassmorphism `GlassCard` component
- `src/utils/export.ts` — CSV (XLSX) and PDF (jsPDF) export utilities

**React Query config:** 5-min stale time, 1 retry, no refetch on window focus.

**Environment variable:**
```
VITE_API_BASE_URL   # Defaults to http://localhost:4000
```

**localStorage keys:** `superadmin_token`, `superadmin_user`, `selected_cafeteria`

---

## Cross-Project Data Flow

```
Booking_System (customer)  ──┐
Booking_Admin (staff)      ──┤──► booking_backend (Express/PostgreSQL/Redis)
Ownerwebsite (superadmin)  ──┘         │
                                        ├── Socket.IO (real-time order events)
                                        ├── FCM (push notifications)
                                        ├── Cashfree (payments)
                                        └── AWS S3 / Cloudinary (file storage)
```

The backend auto-seeds 4 default cafeterias on first start when the DB is empty. All three frontends share the same JWT authentication scheme but hit different endpoint namespaces (`/api/auth/`, `/api/admin/`, `/api/superadmin/`).
