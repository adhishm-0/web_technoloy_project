# CampusHub

CampusHub is a campus communication platform built on the existing React, Vite, Express, JWT, and MongoDB stack. Members can browse audience-aware notices, save bookmarks, track unread items, receive in-app notifications, and view the academic calendar. Administrators can publish and target notices, manage members and events, and review an audit trail.

## Requirements

- Node.js 18 or newer
- A MongoDB database, local or MongoDB Atlas

## Start the website locally

1. Install Node.js 18 or newer and make sure MongoDB is available locally or through MongoDB Atlas.
2. Create the server environment file and install its dependencies:

   ```bash
   cd server
   npm install
   cp .env.example .env
   ```

3. Open `server/.env` and set `MONGO_URI` and `JWT_SECRET`. Generate a private JWT secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   For Atlas, copy the URI from **Database → Connect → Drivers**, replace its placeholders, and use it as `MONGO_URI`. Example format:

   ```dotenv
   MONGO_URI=mongodb+srv://<database-user>:<database-password>@<cluster-host>/<database-name>
   ```

   Allow the computer running the API in Atlas **Security → Network Access**. Keep the completed URI and JWT secret private. Do not commit `server/.env`; it is git-ignored.

4. Start the API in the `server` directory:

   ```bash
   npm run dev
   ```

5. Open a second terminal at the repository root, go to `client/`, and start the website:

   ```bash
   cd client
   npm install
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:5000/api/health](http://localhost:5000/api/health). The Vite development server forwards `/api` requests to the local API. To add the 15 sample notices and calendar events to the configured database, create an account first, then run `npm run seed:demo` from `server/`.

## Deploy the website to Vercel

The live site is [https://web-technoloy-project.vercel.app](https://web-technoloy-project.vercel.app). This repository deploys two Vercel services from the repository root: the Vite website in `client/` and the Express API in `server/`. The root `vercel.json` routes `/api/*` requests to the API and all other paths to the website.

### First-time setup

1. Import this GitHub repository (`adhishm-0/web_technoloy_project`) at [vercel.com/new](https://vercel.com/new), or use the Vercel CLI steps below.
2. Keep the Vercel project root at the **repository root**. Do not set it to `client/`; the root `vercel.json` is needed to deploy and route both services.
3. In the Vercel project’s **Settings → Environment Variables**, add these variables for both **Production** and **Preview**:
   - `MONGO_URI`: the MongoDB Atlas connection URI.
   - `JWT_SECRET`: a unique random value with at least 32 characters. Generate one with the command in the local setup steps above.
4. In Atlas **Security → Network Access**, allow connections from Vercel. Vercel uses dynamic outbound IPs by default, so the API will time out unless Atlas accepts its connection. Vercel Static IPs (Pro or Enterprise) let you allowlist fixed addresses. The broad fallback, `0.0.0.0/0`, lets any public IP attempt a connection; database authentication is still required. Keep the database user restricted and never put the URI in GitHub or this README.
5. Deploy from the Vercel dashboard. The API uses the same `/api` domain as the website, so leave `VITE_API_URL` unset. `CLIENT_ORIGIN` is only needed for intentional cross-origin API calls.

### Deploy with the Vercel CLI

From the repository root, install and sign in to the CLI once:

```bash
npm install --global vercel
vercel login
vercel link
```

When linking, select the existing `web-technoloy-project` project. If asked for its root directory, use the repository root. Add `MONGO_URI` and `JWT_SECRET` for Production and Preview when prompted:

```bash
vercel env add MONGO_URI
vercel env add JWT_SECRET
```

Create a preview deployment, then deploy it to production:

```bash
vercel
vercel --prod
```

After changing Vercel environment variables, redeploy for the new values to take effect. Demo sample records are stored in MongoDB, so they appear on Vercel when its `MONGO_URI` points to the database containing those records.

## Demo data

`npm run seed:demo` inserts or updates 15 clearly labeled illustrative sample notices and creates one linked calendar event for each notice. Sample event dates are generated relative to the seeding date and labeled as illustrative in the notice details and calendar. Run it from `server/` after configuring `MONGO_URI` and creating an active account. The notices and events are attributed to an existing active account; the script does not create accounts, delete records, or reset the database. Each sample uses a stable demo key, so rerunning the command updates those samples instead of duplicating them. Sample poster artwork is stored locally in `client/public/images/demo-notices/` and served at `/images/demo-notices/`.

## Features

- Responsive CampusHub layout, persistent light/dark theme, searchable notices, category/priority filters, pagination, and list/grid views.
- Notice drafts, archive/publish state, expiry, pins, department/year targeting, server-side audience filtering, summaries, issuing departments, optional event start/end times, and administrator photo uploads (JPG, PNG, or WebP up to 2 MB).
- Profile group preferences, per-user bookmarks, unique read receipts, unread filtering, persistent in-app notifications, and a private task planner for assignments and study goals.
- Academic calendar shows the full upcoming event list and month view; members can mark important events privately, and administrators can create or remove events.
- Admin dashboard with database-backed category/activity metrics, member administration, and a read-only audit log.
- Rate-limited authentication routes, bcrypt password hashing, JWT role checks, input validation, bounded request bodies, Helmet headers, restricted CORS, and allowlisted updates.

## API overview

Protected routes use `Authorization: Bearer <token>`. Existing route contracts for `/api/auth`, `/api/notices`, `/api/users`, and `/api/stats` remain available.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Public, rate limited | Create a member account or sign in |
| PUT | `/api/auth/change-password` | Signed in | Change password |
| GET, PATCH | `/api/users/me` | Signed in | Read or update profile group preferences |
| GET | `/api/notices` | Signed in | Search, filter, sort, and paginate visible notices |
| GET | `/api/notices/featured` | Signed in | Get the newest visible pinned notice for the featured board section |
| GET | `/api/notices/:id` | Signed in | Read a notice and create its read receipt |
| POST | `/api/notices/:id/read` | Signed in | Mark a notice read |
| PUT | `/api/notices/:id/bookmark` | Signed in | Toggle a bookmark |
| GET | `/api/notices/bookmarks`, `/api/notices/unread/count` | Signed in | Read personal bookmarks and unread count |
| POST, PUT, DELETE | `/api/notices` and `/api/notices/:id` | Admin | Manage notices |
| GET, POST, PUT, DELETE | `/api/events` | Read signed in; writes admin | Academic calendar |
| GET, POST | `/api/tasks` | Signed in | List or create personal planner tasks |
| PATCH, DELETE | `/api/tasks/:id` | Signed in, task owner | Complete or remove a personal task |
| GET | `/api/events/important` | Signed in | List event IDs marked important by the current user |
| PUT | `/api/events/:id/important` | Signed in | Mark a visible campus event important or remove the mark |
| GET, PATCH, POST | `/api/notifications` | Signed in | List and mark notifications read |
| GET | `/api/audit` | Admin | Read administrative audit history |
| GET | `/api/stats` | Admin | Dashboard analytics |

## Data compatibility

No destructive migration is required. Existing notices without `status` or `audience` remain visible as published campus-wide notices. New notice reads, bookmarks, notifications, events, and audit actions use separate MongoDB collections. Existing users without a department or academic year can still sign in and see campus-wide notices; targeted notices require matching profile groups.

## Current scope and limitations

- A document library and attachments other than the notice photo are not included because no storage provider is configured.
- AI summaries are not included because no server-side AI provider or API key is configured.
- Calendar views include a month grid and selected-day agenda; event editing and week view remain future enhancements.
- Approval workflows, scheduled publishing, email notifications, and detailed read-percentage analytics remain future enhancements.
- Run `npm run build` from `client` to build the web app. The server currently has no dedicated test or lint script.
