# Cofi Bunny — Backend

A real Express + MongoDB API matching the prototype: multi-café orders, role-based
access (customer / partner / admin), and the same "Preparing → Shipping →
Delivered" flow, driven by café partners marking their stop ready.

## What you need first

- **Node.js** installed on your computer (v18 or newer). Check with `node -v`.
- A **MongoDB Atlas** account — it's free to start.
  1. Go to https://www.mongodb.com/cloud/atlas/register and create an account.
  2. Create a free "M0" cluster.
  3. Under **Database Access**, create a database user (username + password — save these).
  4. Under **Network Access**, add your IP address (or `0.0.0.0/0` while developing, so it's reachable from anywhere — tighten this before going live).
  5. Click **Connect > Drivers**, copy the connection string. It looks like:
     `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
```

Now open `.env` and fill in:
- `MONGODB_URI` — your Atlas connection string from above (add `/cofibunny` before the `?` so it uses a database named "cofibunny")
- `JWT_SECRET` — any long random string. Generate one with `openssl rand -hex 32`, or just mash your keyboard for 40 characters.

```bash
# 3. Populate the database with the same 4 cafés and menu the prototype uses,
#    plus 3 demo accounts (admin, café partner, customer)
npm run seed

# 4. Start the API
npm run dev
```

You should see `Cofi Bunny API running on http://localhost:4000`.

## Demo accounts (created by the seed script)

| Role     | Email                  | Password          |
|----------|-------------------------|--------------------|
| Admin    | admin@cofibunny.app     | adminpass123       |
| Partner  | mika@warren.cafe        | partnerpass123     |
| Customer | you@example.com         | customerpass123    |

Log in with any of these to get a token (see below), or sign up a fresh account
— new accounts always start as `customer`; only an admin can promote someone.

## Trying it out

```bash
# Health check
curl http://localhost:4000/api/health

# Log in and grab a token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"customerpass123"}'

# Browse cafés (public, no token needed)
curl http://localhost:4000/api/cafes

# Place an order (replace TOKEN and the menuItemId with real ones from the
# /api/cafes/:id response)
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
        "items": [{ "menuItemId": "PASTE_AN_ID_HERE", "qty": 2 }],
        "pin": { "x": 200, "y": 150 }
      }'
```

## API overview

| Method | Route | Who | What |
|---|---|---|---|
| POST | `/api/auth/signup` | anyone | create a customer account |
| POST | `/api/auth/login` | anyone | get a JWT |
| GET | `/api/cafes` | anyone | list active cafés |
| GET | `/api/cafes/:id` | anyone | one café + its menu |
| PATCH | `/api/cafes/:id` | partner (own café) / admin | update tagline, cover photo, etc. |
| POST | `/api/cafes/:id/menu-items` | partner (own café) / admin | add a validated menu item; new/untrusted submissions wait for approval |
| PATCH | `/api/cafes/menu-items/:itemId` | partner (own café) / admin | edit price, photo, availability; content edits are revalidated |
| POST | `/api/cafes/menu-items/:itemId/reports` | customer | flag a suspicious published item |
| POST | `/api/orders` | customer | place a multi-café order |
| GET | `/api/orders/mine` | customer | your order history |
| GET | `/api/orders/incoming` | partner | orders touching your café |
| GET | `/api/orders/active` | admin | every order still in progress |
| PATCH | `/api/orders/:id/ready` | partner | mark your café's stop ready |
| PATCH | `/api/orders/:id/status` | admin | force a status change |
| GET | `/api/admin/users` | admin | list everyone |
| PATCH | `/api/admin/users/:id/role` | admin | change someone's role |
| PATCH | `/api/admin/users/:id/trust` | admin | set `new`, `trusted`, or `restricted` partner trust tier |
| GET | `/api/admin/cafes` | admin | list cafés with owners |
| GET | `/api/admin/menu-items?status=pending` | admin | review pending or reported items |
| PATCH | `/api/admin/menu-items/:itemId/review` | admin | approve or reject a menu item |
| GET | `/api/admin/menu-reports` | admin | inspect open customer reports |

Menu submissions must use prices from P20 to P1000, a 12–300 character description,
and clean text. Trusted partners with no automated risk flags publish immediately;
new or restricted partners are held for admin review. Prices above P500 are flagged
for review, and two independent customer reports hide a published item until review.

## How photos work right now

Menu item and café cover photos are stored as a `photoUrl` string — pass a
already-hosted image URL, or (for a quick MVP) a base64 data URL like the
frontend prototype currently generates. That works but bloats your database
fast. Before real launch, swap this for actual file storage:

1. Sign up for **Cloudinary** (generous free tier, simplest to wire up) or an S3 bucket.
2. The café partner's browser uploads the photo directly to Cloudinary/S3 and gets back a URL.
3. Your frontend sends that URL to `PATCH /api/cafes/menu-items/:itemId` as `photoUrl` — the API never touches the actual image bytes.

## Making someone an admin or café partner

There's no signup flow for partner/admin — that's intentional, so a stranger
can't self-promote. As the app's admin, log in with the admin account and call:

```bash
curl -X PATCH http://localhost:4000/api/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"role":"partner","cafeId":"CAFE_ID"}'
```

Eventually you'll build a UI for this (the prototype's admin console already
has the screen — it just needs to call this endpoint instead of local state).

## Notes on the delivery-fee math

`src/utils/delivery.js` uses the same demo-map coordinates as the frontend
prototype (`Cafe.mapPosition`). It's good enough to develop against, but
before launch, replace `mapPosition` with real `{ lat, lng }` and recalculate
`computeDelivery` using an actual geocoding/distance API (Google Maps
Distance Matrix or Mapbox Directions) so fees reflect real streets, not
straight-line demo coordinates.

## Next steps from here

- Real-time push: add Socket.io or a Pusher/Ably integration so the
  `ready` and `status` changes in `orders.js` broadcast to connected
  clients instantly, instead of the frontend having to poll.
- Payments: integrate PayMongo or Xendit, capture payment before setting
  `status: "preparing"`.
- Rate limiting + input validation (e.g. with `express-rate-limit` and `zod`)
  before this goes anywhere near the public internet.
