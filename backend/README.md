# KKM Hotels — Backend API

REST + Socket.IO API for a multi-hotel / lodge room booking and management system.
Node.js 20 · Express · MongoDB (Mongoose) · GridFS for every uploaded file · JWT auth.

All data lives in MongoDB, including uploads (guest/booking documents, expense bills,
gallery images, hotel covers), which are stored in GridFS (bucket `uploads`).

## Setup

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `PORT` | | API port (default `5000`) |
| `MONGODB_URI` | **yes** | MongoDB connection string. Use Atlas or a replica set in production (see Transactions) |
| `JWT_SECRET` | **yes** | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | | Token lifetime, e.g. `7d` |
| `CLIENT_URL` | | Allowed frontend origin(s), comma-separated: `http://localhost:3000,https://mydomain.com`. Used for CORS and Socket.IO |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first run | The first admin, created automatically if none exists. Password: at least 8 characters |
| `MAX_UPLOAD_MB` | | Max size per file (default `10`) |
| `TZ` | | Business timezone (default `Asia/Kolkata`) |
| `TRUST_PROXY` | | Proxies in front of the API (default `1`, e.g. Render/Nginx). Set `false` if clients connect directly, so `X-Forwarded-For` can't be faked to dodge rate limits |

| `AADHAAR_ENC_KEY` | yes | 32-byte key as 64 hex characters, used to encrypt Aadhaar numbers (AES-256-GCM). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it safe: changing it makes stored numbers unreadable |
| `PAYMENT_MODE` | | `dummy` (default: no online payment, guests pay at the hotel) or `razorpay` (not enabled yet) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | | For the future Razorpay provider |
| `ONLINE_MAX_ACTIVE_PER_PHONE` | | Upcoming/active online bookings allowed per phone number (default `3`) |

The server refuses to start, with a clear message, if `MONGODB_URI`, `JWT_SECRET` or `AADHAAR_ENC_KEY` is missing.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run

```bash
npm run dev     # development, restarts on file changes (nodemon)
npm start       # production
npm run seed    # create the admin from .env if none exists (also runs on every start)
npm run db      # optional: local test MongoDB (see below)
```

### Local test database

`npm run db` starts the MongoDB server in `.mongo/` (MongoDB 7, not committed) as a one-node
replica set on `127.0.0.1:27017`, so transactions work. Data is kept in `.mongo/data`. Use:

```
MONGODB_URI=mongodb://127.0.0.1:27017/kkm?replicaSet=rs0
```

Run it in its own terminal before `npm run dev`. For real use, point `MONGODB_URI` at Atlas instead.

Health check: `GET http://localhost:5000/api/health`

No hotel is created automatically; log in and add hotels from the portal. Each new hotel gets
the default expense categories: Pantry items, Maintenance, Cleaning, Staff salary, Electricity,
Cable TV, Water, Other.

### Transactions

At startup the server checks whether MongoDB supports transactions (MongoDB Atlas, or any
replica set). If it does, booking create/update runs in a transaction, and two simultaneous
bookings for the same room can never both succeed.

On a standalone `mongod` it logs a warning and runs without transactions. Availability is
re-checked right before saving, and booking writes for a hotel are queued inside the Node
process. That is safe for a **single server instance**; if you run several instances, use a
replica set or Atlas.

For local development with transactions, a one-node replica set is enough:
`mongod --replSet rs0` then once in `mongosh`: `rs.initiate()`, and use
`MONGODB_URI=mongodb://127.0.0.1:27017/kkm?replicaSet=rs0`.

## Conventions

- Base path `/api`. All routes need `Authorization: Bearer <token>` except `/auth/login`,
  `/public/*`, `/health`, `GET /hotels/:id/cover` and `GET /gallery/:id/image`.
- Success: `{ "success": true, "data": …, "message": "…" }`
  Error: `{ "success": false, "message": "…", "errors": [{ "field": "…", "message": "…" }] }`
- Lists accept `?page=&limit=` (default 1 / 20; a limit above 100 is capped to 100) and return
  `{ items, total, page, pages }`.
- Dates: send ISO strings (`2026-10-14T12:00:00+05:30`). A string without an offset
  (`2026-10-14`, `2026-10-14T12:00`) is read as wall-clock time in `TZ`, never the server's timezone. All dates are returned as ISO strings (UTC).
- Phone numbers: 10-digit Indian numbers are stored as `+91XXXXXXXXXX`.
- Numbers: `""` and `null` mean "not sent" (never 0); `NaN`/`Infinity` are rejected.
- Invalid ids return `400`; missing records `404`; business-rule conflicts (double booking,
  deleting something in use) `409`.
- Uploads: `jpg, jpeg, png, webp, pdf` (gallery and cover: images only), up to `MAX_UPLOAD_MB` each.
  Multipart endpoints take a `data` field containing JSON, plus the file field(s).

## Business rules

- **Nights** = calendar days between check-in and check-out dates (in `TZ`), minimum 1.
  14-Oct 12:00 → 16-Oct 11:00 is 2 nights.
- **Totals are always calculated on the server** (totals sent by the client are ignored):
  `roomTotal = Σ ratePerNight × nights` (rate defaults to the room's price, can be overridden per room)
  `gstAmount = (roomTotal + extras − discount) × gstPercent / 100` (gstPercent defaults to the hotel's)
  `grandTotal = roomTotal + extras − discount + gstAmount`
  `paidAmount = Σ payments`, `balance = grandTotal − paidAmount`, recalculated on every payment
  add/delete and booking edit.
- **Availability**: a room is blocked if it is in Maintenance, or a `Booked`/`Checked-in` booking
  overlaps (`existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn`).
  Back-to-back stays (one checks out the moment the next checks in) are allowed.
- **Status flow**: `Booked → Checked-in → Checked-out`, or `Booked → Cancelled`. Anything else is `409`.
  A checked-out booking can still get extra charges / discount / payments, but not new dates or rooms.
- **Income** is counted by payment date; **expenses** by expense date.
- Deleting a hotel with bookings, a room with active/upcoming bookings, or an expense category in
  use returns `409`. Deleting a document or gallery image also deletes its GridFS file.

## Endpoints

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }`. Rate limited (10 failed tries / 15 min) |
| GET | `/auth/me` | Current admin |
| PUT | `/auth/password` | `{ currentPassword, newPassword }` (min 8 chars). Returns a new `{ token, user }`; all older tokens (other devices) stop working |

### Hotels
| Method | Path | Notes |
|---|---|---|
| GET | `/hotels` | `?search=&active=` |
| POST | `/hotels` | multipart: `data` (JSON) + optional `cover` image. Slug generated from name |
| GET | `/hotels/:id` | |
| PUT | `/hotels/:id` | multipart like POST; a new `cover` replaces (and deletes) the old one; `removeCover: true` removes it |
| DELETE | `/hotels/:id` | 409 if the hotel has bookings; otherwise deletes rooms, guests, expenses, gallery, files |
| GET | `/hotels/:id/cover` | **Public**, cached |

Hotel fields: `name, slug, address, area, city, phone, whatsappNumber, email, description,
checkInTime ("12:00"), checkOutTime ("11:00"), mapEmbedUrl, lat, lng, gstPercent, isActive`.
Responses include `coverUrl` (`/api/hotels/<id>/cover`) when a cover exists.

### Rooms
| Method | Path | Notes |
|---|---|---|
| GET | `/rooms?hotelId=` | `&type=&status=&search=`. Each room has `liveStatus` (Occupied / Reserved / Maintenance / Available) and `currentBooking` |
| GET | `/rooms/available?hotelId=&checkIn=&checkOut=&type=` | Rooms free for the whole period |
| POST | `/rooms` | `{ hotelId, roomNumber, type: "AC"/"Non-AC", pricePerNight, floor, bedType, maxGuests, amenities[], status, notes }` |
| POST | `/rooms/bulk` | `{ hotelId, from: 101, to: 110, prefix?, type, pricePerNight, … }`; existing numbers are skipped |
| PUT | `/rooms/:id` | `status` is `Available` or `Maintenance` |
| DELETE | `/rooms/:id` | 409 if it has active or upcoming bookings |

### Guests
| Method | Path | Notes |
|---|---|---|
| GET | `/guests?hotelId=&search=` | Search by name, email or phone digits |
| POST | `/guests` | `{ hotelId, name, phone, email, address, idProofType, idProofNumber, notes }`; 409 if the phone exists |
| GET | `/guests/:id` | Includes `bookings` (history), `documents`, `totals` |
| PUT | `/guests/:id` | |

### Bookings
| Method | Path | Notes |
|---|---|---|
| GET | `/bookings?hotelId=` | `&status=&from=&to=&search=&guestId=&type=`. `from`/`to` match stays overlapping the range; `search` matches guest name/phone, booking no. or room no. |
| GET | `/bookings/inhouse?hotelId=` | Checked-in bookings |
| POST | `/bookings` | JSON, or multipart with `data` (JSON) + optional `files` (documents) |
| GET | `/bookings/:id` | Includes `payments` and `documents` |
| PUT | `/bookings/:id` | Any subset of the create fields (no `hotelId`/`advancePayment`); optional `files` are added as documents |
| POST | `/bookings/:id/checkin` | Booked → Checked-in, sets `actualCheckIn` |
| POST | `/bookings/:id/checkout` | Checked-in → Checked-out, sets `actualCheckOut` |
| POST | `/bookings/:id/cancel` | Booked → Cancelled, `{ reason? }` |
| POST | `/bookings/:id/payments` | `{ amount, mode: Cash/UPI/Card/Bank, date?, note? }` |

Create body:

```json
{
  "hotelId": "…",
  "guestId": "…",                      // OR "guest": { "name", "phone", "email", "address", "idProofType", "idProofNumber" }
  "rooms": ["roomId", { "roomId": "…", "ratePerNight": 1200 }],
  "checkIn": "2026-10-14T12:00:00+05:30",
  "checkOut": "2026-10-16T11:00:00+05:30",
  "adults": 2, "children": 0,
  "extraCharges": [{ "label": "Extra bed", "amount": 200 }],
  "discount": 100,
  "gstPercent": 12,                    // optional, defaults to the hotel's
  "source": "Walk-in",                 // Walk-in | WhatsApp | Phone | Other
  "enquiryId": "…",                    // optional: marks the enquiry Converted
  "notes": "",
  "advancePayment": { "amount": 1000, "mode": "UPI", "note": "" }
}
```

With a `guest` object the guest is matched by normalised phone within the hotel and updated, or
created, inside the same transaction as the booking. Booking numbers are per hotel and year:
`BK-2026-0001`.

### Payments
| Method | Path | Notes |
|---|---|---|
| GET | `/payments?hotelId=&from=&to=` | `&mode=&bookingId=`. Also returns `totals: { amount, count, byMode[] }` for all matches |
| DELETE | `/payments/:id` | Recalculates the booking |

### Documents
| Method | Path | Notes |
|---|---|---|
| POST | `/documents` | multipart: `ownerType` (booking/guest/expense), `ownerId`, `files` |
| GET | `/documents?ownerType=&ownerId=` | |
| GET | `/documents/:id/file` | Streams the file with its Content-Type (auth required); `?download=true` for attachment |
| DELETE | `/documents/:id` | Also deletes the GridFS file |

### Expenses
| Method | Path | Notes |
|---|---|---|
| GET | `/expenses?hotelId=&from=&to=&category=` | `category` = id or name. Returns `totalAmount` for all matches; each item has `bills[]` |
| POST | `/expenses` | multipart: `data` (JSON) + optional `bill`. Fields: `hotelId, date, categoryId (or category name), amount, paidTo, paymentMode, note` |
| PUT | `/expenses/:id` | Same as POST; a new `bill` is added |
| DELETE | `/expenses/:id` | Also deletes its bills |
| GET | `/expense-categories?hotelId=` | |
| POST | `/expense-categories` | `{ hotelId, name }` (hotelId may also be in the query); unique per hotel, case-insensitive |
| DELETE | `/expense-categories/:id` | 409 if used by an expense |

### Gallery
| Method | Path | Notes |
|---|---|---|
| GET | `/gallery?hotelId=` | Sorted by `order`; each item has `imageUrl` |
| POST | `/gallery` | multipart: `hotelId`, `images` (multiple), optional `caption` |
| PUT | `/gallery/:id` | `{ caption?, order? }` |
| DELETE | `/gallery/:id` | Also deletes the GridFS file |
| GET | `/gallery/:id/image` | **Public**, cached |

### Enquiries
| Method | Path | Notes |
|---|---|---|
| GET | `/enquiries?hotelId=&status=` | New / Contacted / Converted / Closed |
| PUT | `/enquiries/:id` | `{ status?, bookingId? }` |

### Reports & dashboard
| Method | Path | Returns |
|---|---|---|
| GET | `/reports/summary?hotelId=&from=&to=` | `income, expenses, profit, expensesByCategory[], paymentsByMode[], occupancyPercent, roomNightsSold, roomNightsAvailable` (defaults to this month) |
| GET | `/reports/yearly?hotelId=&year=` | `months[12]: { month, label, income, expenses, profit }`, `totals` |
| GET | `/dashboard?hotelId=` | `counts { totalRooms, occupied, reserved, available, maintenance, todayCheckIns, todayCheckOuts, newEnquiries }`, `thisMonth { income, expenses, profit, expensesByCategory, paymentsByMode }`, `last6Months[]`, `todayCheckIns[]`, `todayCheckOuts[]`, `roomBoard[]` |

Room board states: **Occupied** (checked-in booking now), **Reserved** (Booked, arriving today),
**Maintenance**, otherwise **Available**.

### Public (no auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/public/hotels` | Active hotels: `name, slug, area, city, coverUrl, startingPrice, roomCount` |
| GET | `/public/hotels/:slug` | Details, `roomTypes[]` (price range, max guests, amenities), `gallery[]`, contact, map |
| POST | `/public/enquiries` | `{ hotelSlug, name, phone, checkIn?, checkOut?, roomType?, guests?, message? }`. Rate limited (5 / 15 min per IP) |
| GET | `/public/config` | `{ paymentEnabled, paymentMode, maxUploadMb }` |
| GET | `/public/hotels/:slug/availability` | `?checkIn&checkOut&adults&children` → `{ totalAvailable, roomTypes[{ type, availableCount, pricePerNight, amenities, maxGuests, photos }] }`. AC and Non-AC share the same free rooms. No room numbers or guest data |
| POST | `/public/hotels/:slug/quote` | `{ checkIn, checkOut, adults, children, rooms: [{ type, quantity }] }` → server price breakdown |
| POST | `/public/hotels/:slug/book` | Multipart: `data` (JSON: stay + `rooms` + `guest{name,phone,email?,address}` + `aadhaar` + `consent: true`) and `aadhaarFiles` (1–2). Confirmed instantly (status `Booked`, source `Online`); lowest free room numbers are assigned. 409 if the rooms were taken meanwhile or the phone has too many active online bookings. Rate limited (10 / hour per IP) |
| GET | `/public/bookings/status` | `?ref=OB-2026-0001&phone=` → status, dates, room numbers, total, balance |

### Online bookings (admin)
| Method | Path | Notes |
|---|---|---|
| GET | `/online-bookings` | `?hotelId&status=new\|upcoming\|checked-in\|completed\|cancelled\|all&from&to&search&unseen&page&limit` (+ `unseen` count) |
| GET | `/online-bookings/unseen-count` | `?hotelId` |
| POST | `/online-bookings/:id/seen` | Mark one as seen |
| POST | `/online-bookings/seen-all` | `?hotelId` |
| POST | `/online-bookings/:id/reveal-aadhaar` | Full Aadhaar number for this response only; who and when is logged on the guest |

Everything else (edit, change room, check-in/out, cancel, payments) uses the normal booking endpoints.

## Real-time (Socket.IO)

Connect to the server URL with the JWT:

```js
const socket = io('http://localhost:5000', { auth: { token } });
socket.emit('join', `hotel:${hotelId}`);   // or just hotelId
```

Events sent to `hotel:<hotelId>`: `booking:created`, `booking:updated`, `room:updated`,
`payment:created`, `payment:deleted`, `expense:created`, `expense:updated`, `enquiry:created`,
`online-booking:created` (`{ bookingId, onlineRef, guestName, roomNumbers, checkIn }`), `online-booking:seen`.

Public namespace (no login), used by the guest booking page:

```js
const pub = io('http://localhost:5000/public');
pub.emit('join', hotelId);
pub.on('availability:changed', () => { /* fetch availability again */ });
```

It only ever sends `availability:changed` (no personal data), after any booking, edit, cancel, check-out or room change.

## Project structure

```
src/
├── server.js            # Starts DB, seeds admin, HTTP + Socket.IO
├── app.js               # Express app: security, CORS, rate limits, routes, errors
├── config/              # env (validation), db (+ transaction detection), gridfs, cors
├── models/              # Mongoose schemas
├── routes/              # Routers + zod request schemas
├── controllers/         # Request handlers
├── services/            # Booking rules, availability/room board, reports, documents
├── middlewares/         # auth (JWT), validate (zod), upload (multer), error handler
├── validators/          # Shared zod schemas
├── sockets/             # Socket.IO auth + hotel rooms
├── utils/               # Errors, responses, dates (IST), phone, slug, locks
└── seed/                # Admin seeding (npm run seed)
```
