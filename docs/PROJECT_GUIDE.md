# KKM Hotels — Project Guide

How this project is built, how to run it on your computer, how to put it online, and where every setting and key lives.

> **Keep real keys out of this file.** Write them in [`KEYS_PRIVATE.md`](KEYS_PRIVATE.md) (private, never uploaded). This guide only explains *what* each key is and *where* it goes.

---

## 1. What the system is

One web app with two faces:

| Part | Who uses it | Address (on your PC) |
|---|---|---|
| **Website** (landing page, hotel pages, online booking, booking status) | Guests | http://localhost:3000 |
| **Admin portal** (bookings, rooms, guests, income, expenses, invoices, reports, settings) | Hotel staff / owner | http://localhost:3000/login |
| **Backend API** (all data and rules) | The website and admin portal talk to it | http://localhost:5000/api |

It handles several hotels at once (KKM BUS STAND, KKM MUKKU SAALAI, …). Every admin page shows data for the hotel chosen in the top bar.

---

## 2. What it's built with

```
 Browser (guest / admin)
        │
        ▼
 FRONTEND  React 18 (Create React App) + Tailwind CSS      folder: frontend/
        │  HTTPS (REST API)  +  WebSocket (live updates)
        ▼
 BACKEND   Node.js 20+ · Express 4 · Socket.IO 4           folder: backend/
        │  Mongoose 8
        ▼
 DATABASE  MongoDB Atlas (cloud)  — database name: KKM
           • normal data (hotels, rooms, bookings, guests, payments, expenses, invoices…)
           • uploaded files (Aadhaar, ID proofs, bills, photos) stored inside MongoDB (GridFS)
```

| Area | Tools | Why |
|---|---|---|
| Frontend | React 18, React Router 6, TanStack Query, Tailwind CSS 3, react-hook-form + zod, lucide icons, socket.io-client | Fast pages, light/dark theme, live refresh |
| Backend | Express 4, Mongoose 8, Socket.IO 4, JWT login, zod validation, multer uploads, pdfkit (invoice PDFs), helmet / rate limits | API, security, real-time updates |
| Database | MongoDB Atlas | Cloud database with backups; supports transactions (stops two people booking the same room) |
| Files | GridFS (inside MongoDB) | No separate file server needed |
| Payments | `dummy` today (guest pays at hotel); Razorpay ready to plug in later | |

---

## 3. Folders you'll actually touch

```
KKM/
├─ docs/                     ← this guide + your private keys sheet
├─ backend/
│  ├─ .env                   ← backend keys & settings (secret, never share)
│  ├─ .env.example           ← list of all backend settings (safe to share)
│  ├─ assets/fonts/          ← font used in invoice PDFs (₹ symbol)
│  ├─ scripts/local-db.js    ← optional local test database (npm run db)
│  └─ src/
│     ├─ server.js           ← starts everything
│     ├─ config/             ← env.js (reads .env), db.js (MongoDB connection)
│     ├─ models/             ← data shapes: Hotel, Room, Booking, Guest, Payment…
│     ├─ routes/ controllers/ services/   ← API endpoints and business rules
│     └─ sockets/            ← live updates (admin + public availability)
└─ frontend/
   ├─ .env                   ← frontend settings (backend address)
   ├─ public/                ← logo.png, favicons, index.html
   └─ src/
      ├─ pages/public/       ← landing, hotel page, online booking, booking status, login
      ├─ pages/admin/        ← every admin screen
      ├─ components/         ← shared pieces (popups, calendar, logo…)
      ├─ api/services.js     ← every call the frontend makes to the backend
      └─ index.css           ← colours / theme
```

---

## 4. Run it on your computer

**Needs:** Node.js 20 or newer (this PC: Node 22), npm, internet (for MongoDB Atlas).

**First time only** — install packages:

```bash
cd backend
npm install

cd ../frontend
npm install
```

**Every day** — open two terminals:

```bash
# Terminal 1 — backend (restarts by itself when code or .env changes)
cd backend
npm run dev            # → http://localhost:5000/api

# Terminal 2 — frontend (opens the browser)
cd frontend
npm start              # → http://localhost:3000
```

**Check it works:** open http://localhost:5000/api/health → you should see `"db":"connected"` and `"transactions":true`.

**Stop:** press `Ctrl + C` in each terminal.

| Command | Folder | What it does |
|---|---|---|
| `npm run dev` | backend | Start backend for development (auto-restart) |
| `npm start` | backend | Start backend for production (no auto-restart) |
| `npm run seed` | backend | Create the first admin from `.env` (also happens automatically on start) |
| `npm run db` | backend | *Optional:* start a local test MongoDB on port 27017 (only if `MONGODB_URI` points to `127.0.0.1`) — not needed with Atlas |
| `npm start` | frontend | Start website + admin portal on port 3000 |
| `npm run build` | frontend | Make the final website files in `frontend/build/` for hosting |

**Port already in use?** Something old is still running. Close the old terminal, or ask for the process on that port to be stopped (ports used: 3000 frontend, 5000 backend).

---

## 5. Settings and keys — where they are and how to change them

There are only **two** settings files. Both are plain text: `NAME=value`, one per line, no quotes, no spaces around `=`.
After changing **backend/.env** the backend restarts itself (`npm run dev`). After changing **frontend/.env** stop and start the frontend again (`Ctrl + C`, then `npm start`).

### 5.1 `backend/.env`

| Key | Required | What it is | Example / how to get it | Changing it later |
|---|---|---|---|---|
| `PORT` | no | Port the backend listens on | `5000` | Also update the frontend's `REACT_APP_API_URL` |
| `MONGODB_URI` | **yes** | Address of the database (includes DB user + password) | Atlas → Database → **Connect** → Drivers → copy. Add `/KKM` after `.mongodb.net` (optional; the app picks `KKM` itself) | Points the app to a different database — data does **not** move by itself |
| `JWT_SECRET` | **yes** | Secret used to sign admin logins | Any long random text. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Everyone is logged out and must log in again |
| `JWT_EXPIRES_IN` | no | How long a login lasts | `7d` (7 days), `12h` | Applies to new logins |
| `CLIENT_URL` | yes (online) | Website address(es) allowed to call the backend | Local: `http://localhost:3000` · Online: `https://your-site.com` · Several: comma-separated | Wrong value = website can't load data ("CORS" error) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first run | First admin account, created only when the database has **no** admin | Password at least 8 characters | Changing these later does **nothing** — change the password in **Admin → Settings** |
| `MAX_UPLOAD_MB` | no | Largest file allowed per upload | `10` | — |
| `TZ` | no | Business time zone | `Asia/Kolkata` | Keep as is |
| `AADHAAR_ENC_KEY` | **yes** | Key that encrypts guests' Aadhaar numbers | 64 hex characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ⚠️ **Never change** once guests have booked — old Aadhaar numbers can no longer be read. Back it up! |
| `PAYMENT_MODE` | no | `dummy` = no online payment, guest pays at hotel | `dummy` (today) · `razorpay` (future) | — |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | later | Razorpay account keys (not used yet) | Razorpay Dashboard → Settings → API Keys | — |
| `ONLINE_MAX_ACTIVE_PER_PHONE` | no | Upcoming online bookings allowed per phone number | `3` | — |
| `TRUST_PROXY` | online | How many proxies sit in front of the backend (for correct visitor IPs / rate limits) | `1` on Render/Railway/Nginx (default) · `false` on a bare server | — |
| `NODE_ENV` | online | `production` hides technical error details | `production` | — |
| `DNS_SERVERS` | rarely | Only if the backend can't find Atlas (`querySrv ECONNREFUSED`) | `8.8.8.8,1.1.1.1` | The app already does this automatically on this PC |

### 5.2 `frontend/.env`

| Key | What it is | Local | Online |
|---|---|---|---|
| `REACT_APP_API_URL` | Backend API address | `http://localhost:5000/api` | `https://your-backend.onrender.com/api` |
| `REACT_APP_SOCKET_URL` | Backend address for live updates | `http://localhost:5000` | `https://your-backend.onrender.com` |

> Frontend values are **baked in when you build** (`npm run build`). After changing them online, rebuild / redeploy the frontend. Never put secrets in `frontend/.env` — everything in it is visible to anyone using the website.

`REACT_APP_WHATSAPP_NUMBER` in `frontend/.env.example` is not used any more; hotel WhatsApp numbers are set per hotel in **Admin → Hotels**.

### 5.3 Settings changed inside the admin portal (not in files)

| Where | What |
|---|---|
| Admin → **Hotels** → Edit | Hotel name, address, phone, WhatsApp, check-in/out times, GST %, GSTIN, map, cover photo, **Online booking on/off**, **Aadhaar upload required**, note for guests |
| Admin → **Rooms** | Rooms, AC / Non-AC prices, amenities, maintenance |
| Admin → **Settings** | Admin password, theme, **Data & Storage** (export / delete old data) |

### 5.4 MongoDB Atlas (cloud.mongodb.com)

| What | Where in Atlas |
|---|---|
| Database user (in `MONGODB_URI`) | Security → **Database Access** |
| Which computers/servers may connect | Security → **Network Access** — add your PC's IP; for a hosted backend add its IP or `0.0.0.0/0` |
| Data, backups, size | Database → Browse Collections / Backup / Metrics |

Free (M0) plan = 512 MB. Uploaded files count. Use **Admin → Settings → Data & Storage** to export and remove old months.

**Change the database password:** Atlas → Database Access → Edit user → new password → update the password inside `MONGODB_URI` in `backend/.env` (and on the hosting site). Avoid `@ : / ? # %` in passwords, or encode them (`@` = `%40`).

---

## 6. Put it online (deploy)

Recommended simple setup (all have free/low-cost plans):

```
 Guests / staff ──► Frontend on Netlify or Vercel (static website)
                         │
                         ▼
                   Backend on Render (Node web service, WebSockets OK)
                         │
                         ▼
                   MongoDB Atlas (already set up)
```

### Step 1 — Backend (Render.com example)
1. Put the project on GitHub (the `.env` files are already ignored and will **not** be uploaded).
2. Render → **New → Web Service** → pick the repo → **Root directory:** `backend`.
3. **Build command:** `npm install` · **Start command:** `npm start` · Node 20+.
4. **Environment** → add every key from section 5.1 with your real values (copy from `KEYS_PRIVATE.md`), plus:
   `NODE_ENV=production`, `TRUST_PROXY=1`, `CLIENT_URL=https://<your frontend address>`.
   Use the **same** `AADHAAR_ENC_KEY` and `MONGODB_URI` you use now.
5. Atlas → Network Access → allow Render (simplest: `0.0.0.0/0`, protected by your DB password).
6. Deploy → open `https://<backend>.onrender.com/api/health` → must show `"db":"connected"`.

### Step 2 — Frontend (Netlify example)
1. Netlify → **Add new site → Import from Git** → same repo.
2. **Base directory:** `frontend` · **Build command:** `npm run build` · **Publish directory:** `frontend/build`.
3. **Environment variables:** `REACT_APP_API_URL=https://<backend>.onrender.com/api` and `REACT_APP_SOCKET_URL=https://<backend>.onrender.com`.
4. Pages like `/admin/bookings` need a "send everything to index.html" rule:
   - Netlify: create `frontend/public/_redirects` containing `/*  /index.html  200`
   - Vercel: create `frontend/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }`
5. Deploy → then put this website address into the backend's `CLIENT_URL` and redeploy the backend.

### Step 3 — Your own domain (optional)
Add the domain in Netlify/Vercel (website) and Render (e.g. `api.yourdomain.com`), then update `CLIENT_URL` and the two `REACT_APP_…` values, and redeploy both. HTTPS is automatic on these hosts.

### After going live — checklist
- [ ] `/api/health` shows connected
- [ ] Admin login works; change the admin password in Settings
- [ ] Online booking from a phone works and appears instantly in **Online Bookings**
- [ ] Invoice PDF downloads
- [ ] `KEYS_PRIVATE.md` updated with the live addresses and keys

---

## 7. Data, privacy and backups

- **Aadhaar numbers** are stored encrypted (AES-256-GCM) with `AADHAAR_ENC_KEY`; admins see only `XXXX XXXX 1234` unless they press **Reveal** (logged).
- **Exports** from Settings → Data & Storage contain full guest details and Aadhaar numbers — store those CSV files privately.
- **Delete** in Data & Storage removes data from MongoDB permanently (current month is always kept, export first). Income and expenses are deleted separately.
- **Backups:** Atlas paid tiers have automatic backups; on the free tier, export each month from Data & Storage.

---

## 8. Common problems

| Problem | Fix |
|---|---|
| Backend says `Missing required environment variable` | A required key is empty in `backend/.env` (`MONGODB_URI`, `JWT_SECRET`, `AADHAAR_ENC_KEY`) |
| `querySrv ECONNREFUSED` / can't reach Atlas | Internet/DNS issue; the app retries with public DNS. Also check Atlas Network Access allows your IP |
| `bad auth` / authentication failed | Wrong DB username/password in `MONGODB_URI` |
| Website loads but no data / "CORS" in browser console | `CLIENT_URL` in backend doesn't match the website address exactly |
| Admin shows "Account no longer exists" | Log out and log in again (database changed) |
| `EADDRINUSE` / port in use | An old copy is still running — close it |
| Aadhaar "could not be decrypted" | `AADHAAR_ENC_KEY` was changed — restore the original key |

More API detail: `backend/README.md`.
