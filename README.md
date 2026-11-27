# KNOWFLOW

**Learn. Connect. Remember.**

KNOWFLOW is a private learning workspace. Phase 1 provides the responsive landing page, account registration and sign-in, a protected dashboard shell, and profile management. Document analysis and learning features are intentionally not part of this phase.

## Requirements

- Node.js 20.19+ and npm
- PostgreSQL 14+

## Set up PostgreSQL

Create a PostgreSQL database named `knowflow`, then configure the connection string in `backend/.env`.
If PostgreSQL command-line tools are installed and `psql` is on PATH, create it with:

```powershell
psql -U postgres -c "CREATE DATABASE knowflow;"
```

In PowerShell:

```powershell
cd .\backend
Copy-Item .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` to your PostgreSQL username, password, host, port, and database. Replace `JWT_SECRET` with a private random value of at least 32 characters. Do not commit `.env`.

For example, the URL format is:

```text
postgresql://<user>:<password>@localhost:5432/knowflow?schema=public
```

## Run the backend

From `knowflow/backend`:

```powershell
npm install
npm run prisma:generate
npm run db:deploy
npm run dev
```

The API listens at `http://localhost:4000`. It checks the PostgreSQL connection before starting; a missing or unavailable database is reported as an error.

## Run the frontend

In a second PowerShell window, from `knowflow/frontend`:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to the backend.

## Run checks

From `knowflow/frontend`:

```powershell
npm run build
npm run lint
```

From `knowflow/backend`:

```powershell
npm test
npm run prisma:generate
```

The API tests exercise validation, account creation, sign-in, protected profile access, updates, duplicate email handling, and logout using a test-only in-memory Prisma substitute. They do not replace testing against a running PostgreSQL instance.

## Phase 1 APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Validate input, hash the password, create an account, and issue an HTTP-only session cookie |
| `POST` | `/api/auth/login` | Verify credentials and issue an HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Clear the browser's session cookie |
| `GET` | `/api/auth/me` | Return the authenticated user's public account details |
| `GET` | `/api/profile` | Retrieve the signed-in user's profile |
| `PUT` | `/api/profile` | Update name/email and optionally change the password |
| `GET` | `/api/health` | Check API availability |

Sessions use a signed JWT in an HTTP-only, same-site cookie; the JWT is not exposed to browser JavaScript or stored in local storage. Logout clears the cookie in the browser. The current phase does not include server-side token revocation.

Dashboard counters display zero because Phase 1 does not yet include paper, concept, assessment, or learning-progress records. The remaining sidebar sections are visibly marked as coming later and are not clickable.

## GitHub Push 1

From the project directory, create the Phase 1 commit:

```powershell
git add .
git commit -m "feat: setup knowflow authentication and dashboard foundation"
```

To push after confirming the repository remote and branch:

```powershell
git push -u origin <branch-name>
```

No push is performed automatically.
