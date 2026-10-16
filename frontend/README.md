# KKM Hotels — Frontend

Multi-hotel booking and management system built with React 18 (Create React App) + Tailwind CSS.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Create React App / react-scripts (plain JavaScript — no TypeScript) |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 (`tailwind.config.js`, class-based dark mode) |
| Icons | lucide-react |
| HTTP | axios (auth interceptor + 401 auto-logout) |
| Data fetching | @tanstack/react-query |
| Forms | react-hook-form + zod |
| Charts | recharts |
| Dates | dayjs (timezone: Asia/Kolkata) |
| Currency | Indian ₹ format (Intl.NumberFormat en-IN) |
| Real-time | socket.io-client |
| Notifications | react-hot-toast |

## Setup

```bash
# 1. Clone / navigate into frontend folder
cd frontend

# 2. Copy env file and fill in your backend URL
cp .env.example .env
# Edit .env → REACT_APP_API_URL=http://localhost:5000/api
#              REACT_APP_SOCKET_URL=http://localhost:5000

# 3. Install dependencies
npm install

# 4. Start dev server
npm start          # http://localhost:3000

# 5. Build for production
npm run build      # outputs to build/
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API base URL | `http://localhost:5000/api` |
| `REACT_APP_SOCKET_URL` | Socket.IO server URL | `http://localhost:5000` |
| `REACT_APP_WHATSAPP_NUMBER` | Optional number for the landing page "Book via WhatsApp" button | first hotel's WhatsApp |

Env vars are baked in at build time — restart `npm start` / rebuild after changing `.env`.

**Deploying:** `build/` is a single-page app. Configure the host to serve `index.html` for unknown paths (e.g. `/admin/bookings`), otherwise refreshing a deep link returns 404.

## Folder Structure

```
public/
└── index.html            # HTML shell (CRA injects the bundle)
src/
├── index.js              # Entry: providers, router, react-query
├── App.jsx               # Routes
├── api/
│   ├── axios.js          # Axios instance with auth interceptor
│   └── services.js       # All API service functions
├── components/
│   ├── ConfirmDialog.jsx  # Delete/action confirmation modal
│   ├── EmptyState.jsx     # Empty list state with CTA
│   ├── FileUpload.jsx     # Drag-and-drop file upload
│   ├── Lightbox.jsx       # Full-screen image lightbox
│   ├── Pagination.jsx     # Page navigation
│   └── Skeleton.jsx       # Loading skeleton components
├── context/
│   ├── AuthContext.jsx    # JWT auth state
│   ├── HotelContext.jsx   # Multi-hotel switcher state
│   └── ThemeContext.jsx   # Dark/light mode
├── hooks/
│   ├── useDebounce.js     # Debounced search input
│   └── useSocket.js       # Socket.IO real-time cache invalidation
├── layouts/
│   └── AdminLayout.jsx    # Sidebar + topbar admin shell
├── pages/
│   ├── public/
│   │   ├── LandingPage.jsx
│   │   ├── HotelPage.jsx
│   │   └── LoginPage.jsx
│   └── admin/
│       ├── Dashboard.jsx
│       ├── Hotels.jsx
│       ├── Rooms.jsx
│       ├── Bookings.jsx
│       ├── BookingDetail.jsx
│       ├── NewBooking.jsx
│       ├── Inhouse.jsx
│       ├── Guests.jsx
│       ├── GuestDetail.jsx
│       ├── Income.jsx
│       ├── Expenses.jsx
│       ├── Reports.jsx
│       ├── Gallery.jsx
│       ├── Enquiries.jsx
│       ├── Settings.jsx
│       └── Onboarding.jsx
└── utils/
    ├── csv.js             # Escaped, Excel-friendly CSV export
    ├── currency.js        # ₹ Indian number formatting
    ├── date.js            # dayjs IST helpers
    └── socket.js          # Socket.IO connection manager
```

## Features

### Public Site
- Landing page with hotel cards and WhatsApp CTA
- Hotel page with photo gallery (lightbox), room types, map embed
- WhatsApp enquiry form (POST + auto-open wa.me link)
- Floating WhatsApp button on mobile

### Admin Portal
- JWT authentication with auto-logout on 401
- Multi-hotel switcher (dropdown in top bar, persisted in localStorage)
- First-run onboarding (no rooms/hotels → redirect to setup)
- **Dashboard**: Stats, bar chart (income vs expenses), pie chart (expenses by category), live room grid
- **Hotels**: Add / edit / delete hotels with cover image upload
- **Rooms**: Individual add or bulk add (e.g. 101–110 AC at ₹1500), amenity tags
- **Bookings**: Filter by status/type/date, new booking wizard (4 steps)
- **Booking Detail**: Check-in/out/cancel, payment history, document upload/download
- **In-House**: Live list of checked-in guests with quick check-out
- **Guests**: Search, detail page with full booking history
- **Income**: Date presets, payment mode breakdown, CSV export
- **Expenses**: CRUD, custom categories, bill upload, CSV export
- **Reports**: KPI summary, yearly bar chart, month-by-month table, category pie
- **Gallery**: Multi-upload, caption editing, lightbox, delete
- **Enquiries**: Status tracking (New/Contacted/Converted/Closed), convert to booking
- **Settings**: Dark mode, default GST %, password change

### Real-time
Socket.IO events auto-invalidate react-query cache:
`booking:created/updated`, `room:updated`, `payment:created`, `expense:created`, `enquiry:created`
