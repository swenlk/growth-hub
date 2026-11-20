# Training platform

Multi-tenant staff training. Next.js serves the UI and API. MongoDB stores tenants, courses, staff, and assignments. Keycloak handles login. Phase 2 adds Docker and the Keycloak realm. Sign-in in the app is still a later phase.

This app uses Next.js 16. Route protection will live in `proxy.ts` (the replacement for `middleware.ts`).

## Prerequisites

- Node.js 20+
- Docker Desktop (or Docker Engine with Compose)
- MongoDB listening on `localhost:27017`
- MySQL listening on `localhost:3306`

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

On Windows PowerShell, copy the example file with:

```powershell
Copy-Item .env.example .env.local
```

If `.env.local` already exists, keep it. Phase 1 reads `MONGODB_URI`. If that URI has no database name, it uses `MONGODB_DATABASE`, then `training_platform`.

## Verify Phase 1

1. Open [http://localhost:3000](http://localhost:3000). You should see three areas: Tenants, Admin, and Learning.
2. Open each area and confirm the nav matches the role:
   - `/platform/tenants` — Tenants
   - `/admin` — Dashboard, Staff, Courses, Assignments, Reports
   - `/learn` — My training, with Assigned and Completed sections
3. Open [http://localhost:3000/login](http://localhost:3000/login). It explains Keycloak and does not redirect yet.
4. Open [http://localhost:3000/api/health](http://localhost:3000/api/health). With MongoDB running, the response is `ok: true` and lists `tenants`, `courses`, and `staff`. If MongoDB is stopped, the response is HTTP 503 and the pages above still load.

Indexes created on connect:

- `tenants.slug` unique
- `courses.tenantId`
- `staff` unique on `{ tenantId, email }`
- `staff` unique on `keycloakUserId`

## Run it

MySQL and MongoDB stay on the host. Compose starts only `keycloak` and `web`. Containers reach the host as `host.docker.internal`.

### 1. MySQL database

Edit the password in `scripts/mysql-setup.sql` so it matches `KC_DB_PASSWORD`, then run it as a MySQL administrator:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < scripts\mysql-setup.sql
```

This creates database `growth-hub` and user `keycloak`@`%`. Compose uses that database unless `KC_DB_URL_DATABASE` is set.

MySQL must accept connections from Docker, not only from `127.0.0.1`. In `my.ini`, `bind-address` should be `0.0.0.0` or `*`. Restart MySQL after changing it. If Keycloak logs that it cannot reach MySQL, this is the usual cause. MongoDB has the same requirement when `web` runs in Compose: it must listen on an interface Docker can reach.

### 2. Environment

Copy `.env.example` to `.env.local` if you do not already have one. Set at least:

- `KC_DB_USERNAME` and `KC_DB_PASSWORD` (the MySQL account above)
- `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` (first Keycloak admin; `KEYCLOAK_ADMIN_USERNAME` is also accepted)
- `AUTH_SECRET` (any long random string; required when the `web` container starts)

`KEYCLOAK_ADMIN_PASSWORD` is only for the first Keycloak boot. After an admin user exists, changing it in the env file does not reset the password. Keycloak 26.8 only accepts Admin API tokens that include the built-in `kc-admin-api` client scope. `npm run setup:keycloak` assigns that scope to `growth-hub-admin`.

### 3. Keycloak only (day-to-day dev)

Next.js stays on the host and uses local MongoDB. Keycloak runs in Docker.

```powershell
docker compose --env-file .env.local up keycloak
```

Expected: the container becomes healthy, and [http://localhost:8080](http://localhost:8080) shows the Keycloak welcome page. The admin console is [http://localhost:8080/admin](http://localhost:8080/admin). The first boot migrates the MySQL schema and can take one to two minutes.

In another terminal, from the project root:

```powershell
npm install
npm run setup:keycloak
```

Expected: the script finishes without an error and prints `KEYCLOAK_CLIENT_SECRET` and `KEYCLOAK_ADMIN_CLIENT_SECRET`. Paste those into `.env.local`. Running the script again updates the same realm and prints the same secrets.

Then:

```powershell
npm run dev
```

For this host workflow, set `KEYCLOAK_INTERNAL_URL=http://localhost:8080`. The browser and the Next.js process both use localhost. Open [http://localhost:3000](http://localhost:3000).

### 4. Both containers

```powershell
docker compose --env-file .env.local up --build
```

Expected: `docker compose ps` shows `keycloak` healthy and `web` running. The app is at [http://localhost:3000](http://localhost:3000) and Keycloak is at [http://localhost:8080](http://localhost:8080). Uploaded videos will live in `./media`, which is mounted at `/app/media`.

The `web` service forces `KEYCLOAK_INTERNAL_URL=http://keycloak:8080`. Do not point that container at `localhost:8080`; inside the container, localhost is the Next.js process itself.

### Issuer URL

`KC_HOSTNAME=http://localhost:8080` makes Keycloak advertise that URL as the issuer (`http://localhost:8080/realms/growth-hub`). The browser can use it. The `web` container cannot, because `localhost` inside that container is not Keycloak.

`KEYCLOAK_ISSUER` stays on the public URL (`http://localhost:8080/realms/growth-hub`). That is the address the browser opens and the `iss` claim in tokens. Server-side Auth.js fetches (discovery, token, refresh, JWKS) are rewritten to `KEYCLOAK_INTERNAL_URL`. In Compose that is `http://keycloak:8080`. On the host it is `http://localhost:8080`. `KC_HOSTNAME_STRICT=false` lets those internal requests through.

## Sign in

There is one Sign in button. The home page does not offer a separate entrance per role. Open [http://localhost:3000/login](http://localhost:3000/login). The page continues to Keycloak. Sign out ends both the app session and the Keycloak session. After a successful login the app sends:

- `super_admin` to `/platform/tenants`
- `tenant_admin` to `/admin`
- `staff` to `/learn`

The first platform account is still created in the Keycloak `growth-hub` realm with the `super_admin` role. After that, sign in and create an organization on Tenants. The page shows the first admin's temporary password once. That admin signs in through the same button and lands on the organization dashboard, where they add staff the same way.

Visiting another role's area sends you back to your own home. `/api/auth` and `/api/health` stay reachable without a session. Other `/api` routes return 401 until you are signed in. The session carries `sub`, `roles`, and `tenantId` from the token. Tenant-scoped code must use `requireTenant()` and must not trust a tenant id sent by the browser.

The `growth-hub` realm allows HTTP (`sslRequired=NONE`) so the container can call Keycloak without TLS. That is a local development setting. Production must terminate TLS and require HTTPS.

Keycloak 26 includes Organizations. This project keeps one realm and a `tenantId` user attribute. Moving to Organizations is a later upgrade, not the current model.
