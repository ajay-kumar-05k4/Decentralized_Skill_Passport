# Digital Skill Passport — frontend

React (Vite) UI for the Express API. Airbnb-inspired layout: sticky header, centered search pill, category chips, listing cards, and a multi-column footer.

Blockchain / MetaMask / IPFS screens are not included. Identity is hash-based off-chain only.

## Run

Backend must already be running. For local development, set `CLIENT_URL=http://localhost:3000` in
`backend/.env`; the frontend proxy defaults to `http://127.0.0.1:5000`.

To use a different backend, create `frontend/.env` with:

```bash
VITE_BACKEND_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000/api
```

Use the deployed API URL for both values when the frontend and backend are hosted separately.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — Vite proxies `/api` and `/uploads` to the backend.

## Pages

| Route | Who |
| --- | --- |
| `/` | Public home |
| `/login` `/register` | Auth |
| `/explore` | Skill catalogue |
| `/passport` `/profile` `/credentials` | Learner passport |
| `/identity` | Register / recover identity hash |
| `/share` `/p/:token` | Shareable passport |
| `/verify` | Public hash verification desk |
| `/review` | Institution / mentor / admin queue |
| `/talent` | Recruiter lookup by user id |
| `/admin` | Platform stats and users |
| `/notifications` `/settings` | Account |

Seed skills with `npm run seed` in `backend` so Explore is not empty.
