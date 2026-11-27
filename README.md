# KNOWFLOW

**Learn. Connect. Remember.**

KNOWFLOW is a private learning workspace. Phase 1 added registration and profile management. Phase 2 added secure PDF storage and the document library. Phase 3 extracts page structure with PyMuPDF and uses a configured AI provider to build a source-grounded topic and concept analysis.

## Requirements

- Node.js 20.19+ and npm
- PostgreSQL 14+
- Python 3.10+ and pip

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
Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend/.env` to enable real AI analysis. `OPENAI_BASE_URL` can point to an OpenAI-compatible provider. The API key stays on the backend. Extracted PDF text is sent to that configured provider for analysis; do not enable a provider unless that data transfer is acceptable. Without provider configuration, analysis is marked failed with a clear setup message rather than returning mock results.
`ANALYSIS_CHUNK_CHARACTERS` defaults to 12000 characters per AI request and `ANALYSIS_CONCURRENCY` defaults to one document at a time. These settings bound per-request context and processing load; documents are split into sequential chunks.

Set up the PDF processor from `knowflow/backend` in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\pdf_processor\requirements.txt
```

If needed, set `PYTHON_EXECUTABLE` in `backend/.env` to the Python executable for this environment. Image-only scanned PDFs need OCR before they can be analyzed; the current extractor reports when it finds no readable text.

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
Run `npm run db:deploy` after each phase adds a migration. The Phase 3 migration adds persisted page extraction, analysis progress, topics, concepts, source references, and relationships.

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

The API tests exercise authentication, document uploads, and analysis flows using test-only in-memory Prisma substitutes. They do not replace testing against a running PostgreSQL instance.
From `knowflow/backend`, test the Python extraction service with:

```powershell
python -m unittest discover -s pdf_processor -p "test_*.py" -v
```

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
| `POST` | `/api/analysis/:documentId` | Queue or retry analysis for one owned paper |
| `POST` | `/api/analysis/batch` | Queue analysis for multiple owned papers |
| `GET` | `/api/analysis/:documentId` | Retrieve analysis, topics, concepts, relationships, and source pages |
| `GET` | `/api/analysis/:documentId/status` | Read persisted processing status and progress |
| `GET` | `/api/analysis/topics?documentId=...` | List the signed-in user's topics and subtopics |
| `GET` | `/api/analysis/concepts` | Cursor-page and search the signed-in user's deduplicated concepts |
| `GET` | `/api/analysis/concepts/:id` | Retrieve a concept with all of its document sources and relationships |

Sessions use a signed JWT in an HTTP-only, same-site cookie; the JWT is not exposed to browser JavaScript or stored in local storage. Logout clears the cookie in the browser. The current phase does not include server-side token revocation.

Dashboard paper totals and recent paper activity come from the user's saved documents. Concept, weak-concept, and learning-progress values remain zero until their later phases record real data. Sidebar sections not yet implemented remain visibly marked as coming later.

PDF bytes are stored on private local disk, not in PostgreSQL. PostgreSQL stores metadata, extracted page text and structure, analysis progress, normalized topics and concepts, and document/page-specific source excerpts. PyMuPDF extracts text page by page; the backend chunks that actual text for AI requests and validates every returned concept citation against its quoted page text before saving. Concepts are deduplicated per user by normalized name, while source excerpts and explanations remain attached to each document and page. The queue is persisted in PostgreSQL and resumes queued or interrupted jobs when the backend starts. Failed jobs can be retried from My Papers or the analysis page.

## GitHub Push 3

From the project directory, create the Phase 3 commit without staging unrelated frontend package changes:

```powershell
git add README.md backend frontend/.env.example frontend/src
git commit --only -m "feat: add deep AI document analysis and concept extraction" -- README.md backend frontend/.env.example frontend/src
```

To push after confirming the repository remote and branch:

```powershell
git push -u origin <branch-name>
```

No push is performed automatically.
