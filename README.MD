# Community-Powered Protocol & Discussion Platform

A full-stack platform for creating, sharing, and discussing community protocols. Built with **Laravel** (API) and **Next.js** (UI), with **Typesense** powering real-time full-text search.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Frontend Overview](#frontend-overview)
- [Typesense Configuration](#typesense-configuration)
  - [Running Typesense Locally with Docker](#running-typesense-locally-with-docker)
- [API Overview](#api-overview)
  - [Authentication](#authentication)
  - [Protocols](#protocols)
  - [Threads](#threads)
  - [Comments](#comments)
  - [Reviews](#reviews)
  - [Votes](#votes)

---

## Prerequisites

| Requirement | Version |
|---|---|
| PHP | 8.3+ |
| Composer | Latest |
| Node.js | 20.9+ |
| MySQL | Latest |
| Typesense | Local or Cloud |

---

## Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/balilirichel/Community-Powered-Protocol-Discussion-Platform.git
cd api

# 2. Install PHP dependencies
composer install

# 3. Copy and configure environment variables
cp .env.example .env

# 4. Generate application key
php artisan key:generate

# 5. Run database migrations
php artisan migrate

# 6. Seed with mock data (12 protocols, 10 threads, comments, reviews, votes)
php artisan db:seed

# 7. Build Typesense collections and index all records
php artisan typesense:reindex

# 8. Start the development server
php artisan serve
```

Backend API runs at `http://127.0.0.1:8000`

---

## Frontend Setup

The UI is a **Next.js 16.3.5** app (Pages Router) in the `ui/` directory.

```bash
cd ui

# 1. Install dependencies
npm install

# 2. Create .env.local (see variables below)
```

Create `ui/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1

NEXT_PUBLIC_TYPESENSE_HOST=localhost
NEXT_PUBLIC_TYPESENSE_PORT=8108
NEXT_PUBLIC_TYPESENSE_PROTOCOL=http
NEXT_PUBLIC_TYPESENSE_API_KEY=your-search-only-api-key
```

> There is no `ui/.env.example` — the `ui/.gitignore` ignores `.env*`, so this file must be created manually. The Typesense key must be a **search-only** key (see [Typesense Configuration](#typesense-configuration)).

```bash
# 3. Start the development server
npm run dev
```

Frontend runs at `http://localhost:3000` (Next.js default; no custom port is set in `next.config.ts`).

**Available scripts** (`ui/package.json`):

| Script | Command |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `eslint` |

---

## Frontend Overview

Verified against the code in `ui/`.

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js **16.3.5** (Pages Router — root `pages/` directory; no App Router) |
| UI library | React **19.2.8**, TypeScript |
| State | Redux Toolkit **2.12.0** + react-redux **9.3.0** |
| HTTP | axios **1.20.0** |
| Styling | Tailwind CSS **v4** (CSS-first config via `postcss.config.mjs`; no `tailwind.config.*`), Satoshi font |
| Search | `typesense` **3.0.6** (browser queries Typesense directly) |
| Toasts | react-toastify **11.1.0** |
| Icons | lucide-react **1.47.0** |

### Routes

Route files live in `ui/pages/` (the routing directory). Each imports its page component from `ui/src/pages/` with `next/dynamic` and `{ ssr: false }` — all page bodies run client-side only.

| Route | Page component | Access |
|---|---|---|
| `/` | `src/pages/HomePage.tsx` | Public |
| `/login` | `src/pages/LoginPage.tsx` | Redirects to `/` if authenticated |
| `/register` | `src/pages/RegisterPage.tsx` | Redirects to `/` if authenticated |
| `/profile` | `src/pages/ProfilePage.tsx` | Protected — redirects to `/login` |
| `/threads` | `src/pages/ThreadPage.tsx` | Public |
| `/threads/[id]` | `src/pages/ThreadDetailsPage.tsx` | Public (auth-gated actions); **requires `?protocolId=` query param** |
| `/protocols/create` | `src/pages/CreateProtocolPage.tsx` | Protected — redirects to `/login` |
| `/protocols/[slug]` | `src/pages/ProtocolDetailPage.tsx` | Public (edit/delete owner-only) |

`pages/api/hello.ts` is create-next-app boilerplate, unrelated to the Laravel API.

### Authentication

- Login/register responses (`{ data: { user, token } }`) are stored via Redux `authSlice`; the bearer token is persisted in `localStorage` under the key `auth_token`.
- The axios instance in `src/api/client.ts` attaches `Authorization: Bearer {token}` from Redux on every request; a `401` response dispatches `clearAuth()` (clears state and localStorage).
- `pages/_app.tsx` calls `GET /api/v1/user` once on startup if a token exists, to rehydrate the session.
- Auth-gated actions (comment, vote, review, create thread) open a login-required modal via `useRequireAuth` rather than hard-redirecting.

### Search

- `src/typesense/typesenseClient.ts` builds a Typesense client from the `NEXT_PUBLIC_TYPESENSE_*` env vars and queries the `protocols` and `threads` collections directly from the browser.
- `src/hooks/useTypesenseSearch.ts` debounces input (200ms) and falls back to the Laravel backend (`GET /api/v1/search/protocols` and `/api/v1/search/threads`) if Typesense errors or returns 0 hits.

### API client

- Base URL: `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://127.0.0.1:8000/api/v1`).
- Service modules in `src/api/`: `authService`, `protocolService`, `threadService`, `commentService`, `reviewService`, `searchService`, `chatService`.
- Non-422 errors are normalized to `ApiError { message, errors?, status }` and dispatched to Redux `ui.globalError`.

---

## Typesense Configuration

Typesense is used for full-text search on protocols and threads. The frontend queries Typesense directly using a search-only key. The backend handles all indexing automatically via model observers.

### Backend `.env`

```env
SCOUT_DRIVER=typesense
TYPESENSE_HOST=127.0.0.1
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your-admin-api-key
```

### Frontend `ui/.env.local`

```env
NEXT_PUBLIC_TYPESENSE_HOST=your-typesense-host-url
NEXT_PUBLIC_TYPESENSE_PORT=8108
NEXT_PUBLIC_TYPESENSE_PROTOCOL=http
NEXT_PUBLIC_TYPESENSE_API_KEY=your-search-only-api-key
```

> **Important:** The frontend must use a **search-only API key**, never the admin key. Generate one from your Typesense dashboard or via the Typesense Keys API.

### Running Typesense Locally with Docker

If you don't have a cloud Typesense instance, you can run one locally using Docker.

**Step 1 — Start the Typesense container**

```bash
docker run -d -p 8108:8108 \
  -v /tmp/typesense-data:/data \
  typesense/typesense:26.0 \
  --data-dir /data \
  --api-key=admin-api-key \
  --enable-cors
```

| Flag | Purpose |
|---|---|
| `-d` | Run container in the background |
| `-p 8108:8108` | Expose Typesense on `localhost:8108` |
| `-v /tmp/typesense-data:/data` | Persist data across container restarts |
| `--api-key` | Sets the admin API key — change this to something secure |
| `--enable-cors` | Required for frontend to query Typesense directly from the browser |

Typesense is now running at `http://localhost:8108`.

**Step 2 — Generate a search-only key for the frontend**

The frontend must never use the admin key. Run this to generate a scoped search-only key:

```bash
curl "http://localhost:8108/keys" \
  -X POST \
  -H "X-TYPESENSE-API-KEY: admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Search-only key for frontend",
    "actions": ["documents:search"],
    "collections": ["*"]
  }'
```

The response will include a `value` field — copy that and use it as `NEXT_PUBLIC_TYPESENSE_API_KEY` in your `ui/.env.local`.

> Replace `admin-api-key` in the curl command with whatever you set in Step 1.

**Step 3 — Update your backend `.env`**

```env
TYPESENSE_HOST=127.0.0.1
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=admin-api-key
```

**Step 4 — Index existing records**

```bash
php artisan scout:import "App\Models\Protocol"
php artisan scout:import "App\Models\Thread"
```

---

### Manual Indexing

To manually import all records into Typesense:

```bash
php artisan scout:import "App\Models\Protocol"
php artisan scout:import "App\Models\Thread"
```

> Indexing is also triggered automatically whenever a Protocol or Thread is created, updated, or deleted via model observers.

---

## API Overview

All API routes are prefixed with `/api/v1`. Protected routes require a Sanctum bearer token in the request header.

```
Authorization: Bearer {token}
```

---

### Authentication

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| Register | `POST /api/v1/register` | No |
| Login | `POST /api/v1/login` | No |
| Logout | `POST /api/v1/logout` | Yes |

**Login response** returns a bearer token to be used on all subsequent authenticated requests.

---

### Protocols

Protocols are the primary content unit — structured guides authored by community members.

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| List all protocols | `GET /api/v1/protocols` | No |
| View a protocol | `GET /api/v1/protocols/{id}` | No |
| Create a protocol | `POST /api/v1/protocols` | Yes |
| Update a protocol | `PUT /api/v1/protocols/{id}` | Yes (owner only) |
| Delete a protocol | `DELETE /api/v1/protocols/{id}` | Yes (owner only) |

**Fields:** `title`, `content`, `tags` (array), `author_id`, `average_rating` (computed)

**Query Parameters for `GET /api/v1/protocols`:**

| Parameter | Behavior |
|---|---|
| `search` | Full-text search via Typesense |
| `sort=latest` | Order by most recently created |
| `sort=most_reviewed` | Order by review count |
| `sort=top_rated` | Order by average review rating |

---

### Threads

Threads are discussions posted under a specific protocol.

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| List threads under a protocol | `GET /api/v1/protocols/{id}/threads` | No |
| View a thread | `GET /api/v1/threads/{id}` | No |
| Create a thread | `POST /api/v1/protocols/{id}/threads` | Yes |
| Update a thread | `PUT /api/v1/threads/{id}` | Yes (owner only) |
| Delete a thread | `DELETE /api/v1/threads/{id}` | Yes (owner only) |

**Fields:** `title`, `body`, `protocol_id`, `author_id`, `vote_score` (computed)

**Query Parameters for `GET /api/v1/protocols/{id}/threads`:**

| Parameter | Behavior |
|---|---|
| `search` | Full-text search via Typesense |
| `sort=latest` | Order by creation date |
| `sort=most_upvoted` | Order by net vote score |

---

### Comments

Comments support nested replies — a comment can belong to either a thread or a parent comment.

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| List comments on a thread | `GET /api/v1/threads/{id}/comments` | No |
| Add a comment to a thread | `POST /api/v1/threads/{id}/comments` | Yes |
| Reply to a comment | `POST /api/v1/comments/{id}/replies` | Yes |
| Update a comment | `PUT /api/v1/comments/{id}` | Yes (owner only) |

**Fields:** `body`, `thread_id`, `parent_id` (nullable), `author_id`

---

### Reviews

Reviews allow users to rate a protocol with a numeric score and optional written feedback.

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| List reviews for a protocol | `GET /api/v1/protocols/{id}/reviews` | No |
| Add a review | `POST /api/v1/protocols/{id}/reviews` | Yes |
| Update a review | `PUT /api/v1/reviews/{id}` | Yes (owner only) |
| Delete a review | `DELETE /api/v1/reviews/{id}` | Yes (owner only) |

**Fields:** `rating` (1–5), `feedback` (optional text), `protocol_id`, `author_id`

> Each user may submit **one review per protocol**. A second submission returns `422 Unprocessable Entity`.

---

### Votes

A polymorphic voting system that supports upvotes and downvotes on both threads and comments.

| Action | Method & Endpoint | Auth Required |
|---|---|---|
| Vote on a thread | `POST /api/v1/threads/{id}/vote` | Yes |
| Vote on a comment | `POST /api/v1/comments/{id}/vote` | Yes |

**Request body:**

```json
{ "type": "upvote" }
```

```json
{ "type": "downvote" }
```

**Vote behavior:**

- Each user may cast **one vote** per thread or comment.
- Submitting the **same vote type** again removes the vote (toggle off).
- Submitting the **opposite vote type** switches the vote.
- `vote_score` = total upvotes − total downvotes, returned on thread and comment responses.

---

> All routes are protected by Laravel Policies. Users may only modify or delete resources they own.