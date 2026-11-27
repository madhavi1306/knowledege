# KNOWFLOW

**Learn. Connect. Remember.**

KNOWFLOW is a private learning workspace. Phase 1 added registration, sign-in, a protected dashboard shell, and profile management. Phase 2 adds private PDF storage and a real document library. Deep AI analysis and learning features are intentionally not part of this phase.

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
`STORAGE_DIR` defaults to the private `backend/storage` folder. Choose a durable, non-public path for deployed environments. `MAX_PDF_SIZE_MB` defaults to 50 MB per file and can be changed to fit available resources. There is no total document-count limit. `UPLOAD_CONCURRENCY` controls simultaneous server-side validation and defaults to 2.

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
Run `npm run db:deploy` after each phase adds a migration.

## Run the frontend

In a second PowerShell window, from `knowflow/frontend`:

```powershell
npm install
npm run dev
```

The browser queue uses two concurrent uploads and continues through every selected PDF; it has no fixed file-count limit. If you change `MAX_PDF_SIZE_MB`, set the same value in `frontend/.env` as `VITE_MAX_PDF_SIZE_MB`.

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
npm run prisma:validate
npm audit
```

The API tests exercise authentication and document flows using a test-only in-memory Prisma substitute. They do not replace testing against a running PostgreSQL instance.

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
| `POST` | `/api/documents/upload` | Validate a PDF, store it privately, and save its metadata |
| `GET` | `/api/documents` | Search, filter, and cursor-page through the signed-in user's documents |
| `GET` | `/api/documents/:id` | Retrieve the signed-in user's document details |
| `GET` | `/api/documents/:id/status` | Read the document upload/analysis status |
| `GET` | `/api/documents/:id/file` | Open the PDF through an authenticated, hardened response |
| `DELETE` | `/api/documents/:id` | Remove the owned PDF and its metadata |

Sessions use a signed JWT in an HTTP-only, same-site cookie; the JWT is not exposed to browser JavaScript or stored in local storage. Logout clears the cookie in the browser. The current phase does not include server-side token revocation.

Dashboard paper totals and recent paper activity come from the user's saved documents. Concept, weak-concept, and learning-progress values remain zero until their later phases record real data. Sidebar sections not yet implemented remain visibly marked as coming later.

PDF bytes are stored on private local disk, not in PostgreSQL. PostgreSQL stores the file metadata, user relationship, upload status, and a per-user content hash used to detect exact duplicate uploads. Uploads are validated by extension, MIME type, PDF header, and PDF parser before being stored. A user's complete PDF collection has no fixed count limit; listing uses cursor pagination. Failed network/server uploads can be retried individually in the queue.

## GitHub Push 2

From the project directory, create the Phase 2 commit:

```powershell
git add README.md backend frontend/.env.example frontend/src
git commit -m "feat: add secure PDF upload and document management"
```

To push after confirming the repository remote and branch:

```powershell
git push -u origin <branch-name>
```

No push is performed automatically.
