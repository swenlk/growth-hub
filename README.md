# Growth Hub

Multi-tenant staff training. Next.js serves the UI and API. MongoDB stores tenants, courses, staff, and assignments. Keycloak handles login.

MySQL and MongoDB stay on the host. Docker runs Keycloak and the app. Commands are from the project root. Compose reads `.env`.

Prerequisites: Node.js 20+, Docker, MySQL 8 on port 3306, MongoDB on port 27017.

## Deployment

### 1. Install

```powershell
npm install
```

### 2. Environment

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the printed value in `AUTH_SECRET`. Set `KEYCLOAK_ADMIN_PASSWORD` and `KC_DB_PASSWORD`. Leave `KEYCLOAK_CLIENT_SECRET` and `KEYCLOAK_ADMIN_CLIENT_SECRET` empty until step 5.

In `scripts/mysql-setup.sql`, set `IDENTIFIED BY` to the same password as `KC_DB_PASSWORD`.

MySQL must accept Docker connections. In `my.ini`, set `bind-address = 0.0.0.0` and restart MySQL.

### 3. MySQL

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "source C:/Projects/growth-hub/scripts/mysql-setup.sql"
```

### 4. Keycloak

```powershell
docker compose up keycloak
```

Wait until `docker compose ps` shows `keycloak` healthy. Leave this terminal open. First boot can take one to two minutes.

### 5. Realm and secrets

Second terminal:

```powershell
npm run setup:keycloak
```

Copy the printed block into `.env`:

```text
KEYCLOAK_ISSUER=...
KEYCLOAK_CLIENT_ID=growth-hub-web
KEYCLOAK_CLIENT_SECRET=...
KEYCLOAK_ADMIN_CLIENT_ID=growth-hub-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=...
```

Keep `KEYCLOAK_INTERNAL_URL=http://localhost:8080`. The web container sets `http://keycloak:8080` itself.

### 6. App

Stop the Keycloak terminal with Ctrl+C, then:

```powershell
docker compose down
docker compose up -d --build
```

### 7. Check

```powershell
docker compose ps
```

- App: http://localhost:3000
- Health: http://localhost:3000/api/health
- Keycloak admin: http://localhost:8080/admin

Create the first user in realm `growth-hub` with realm role `super_admin`, then sign in at http://localhost:3000/login.

## Later

```powershell
docker compose up -d --build
docker compose down
docker compose logs -f web
docker compose logs -f keycloak
npm run setup:keycloak
```

`docker compose down` does not delete MySQL, MongoDB, or `./media`.

Host-only app (Keycloak still in Docker):

```powershell
docker compose up keycloak
npm run dev
```

## Production

Before the host is public:

- Use real passwords for MySQL, `KEYCLOAK_ADMIN_PASSWORD`, and `AUTH_SECRET`.
- Set `AUTH_URL=https://<app-host>` and `KEYCLOAK_ISSUER=https://<auth-host>/realms/growth-hub`.
- In `docker-compose.yml`, change `KC_HOSTNAME` from `http://localhost:8080` to the public Keycloak origin, and change Keycloak `start-dev` to `start`.
- In Keycloak, set the web client redirect URI, web origin, and post-logout URI to `https://<app-host>`, and require HTTPS. `npm run setup:keycloak` writes `http://localhost:3000` and `sslRequired=NONE` again, so do not re-run it until the script matches those public URLs.
- Put TLS in front of ports 3000 and 8080.
- Back up MySQL database `growth-hub`, MongoDB database `growth_hub`, and `./media`.

```powershell
docker compose up -d --build
```
