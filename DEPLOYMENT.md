# Deployment

## Pre-deployment verification

Run the automated checks from the repository root:

```powershell
Push-Location backend
npm test
Pop-Location

Push-Location frontend
npm run lint
npm run build
Pop-Location
```

The frontend has no automated interaction-test suite yet. Before deploying, verify these flows locally with MongoDB and both development servers running:

- Create an open meeting and submit attendance from a phone or browser with location permission. The check-in page should show GPS accuracy and distance before submission. A location whose distance plus GPS accuracy exceeds the meeting radius should be recorded as `needs_review`, not confirmed present.
- In the admin dashboard, confirm that new check-ins and the four attendance counts update within about three seconds, while the rotating-code countdown continues to update each second.
- Try each feed sort: recent, most risky, farthest away, and worst GPS accuracy. Missing distance or accuracy values should sort after measured values for their respective sort modes.
- Select several `needs_review` entries and accept or reject them with a reason. Successful entries should update in place; failed entries should remain selected and show an error. Also verify that row actions are disabled during a bulk request.
- Confirm the rejected count changes after an individual or bulk rejection.

For a production smoke test, check in from a phone over HTTPS, then verify the result and dashboard record. GPS data is supplied by the volunteer's device and should not be treated as tamper-proof evidence on its own.

## Environment variables

No third-party API keys are required. Configure these values:

| Variable | Service | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Backend | MongoDB Atlas connection string |
| `ADMIN_PASSWORD` | Backend | Admin login password; set a unique strong value |
| `JWT_SECRET` | Backend | Signs admin sessions; use a long random secret |
| `FRONTEND_URL` | Backend | Exact allowed frontend origin for CORS |
| `VITE_API_URL` | Frontend | Backend API base URL, ending in `/api` |

Set backend values in `backend/.env` for local development and in the Render service environment for production. Set `VITE_API_URL` in `frontend/.env` locally and in Vercel's project environment variables for production. Never commit real `.env` files or production secrets. The `.env.example` files contain placeholders or local defaults only.

`FRONTEND_URL` must match the browser origin exactly, including `https://` and the hostname, with no path. Multiple allowed origins can be comma-separated. For production, set it to the deployed Vercel origin; do not leave it blank because an unset value allows requests from any origin.

The backend health check returns HTTP 200 with `status: "ok"` and `database: "connected"` only after MongoDB connects. While the database is unavailable or still connecting, it returns HTTP 503 with `status: "starting"` and `database: "disconnected"`.

## 1. MongoDB Atlas

1. Create a free MongoDB Atlas account and a free shared cluster.
2. Create a database user and save its username and password.
3. In **Network Access**, add the Render service IP range. For a first deployment, `0.0.0.0/0` works but should be restricted when the service has a fixed egress range.
4. Copy the driver connection string and replace its placeholders. The database name should be `smart-attendance`.
5. Run the seed script once against Atlas only if you want the sample event and admin data:

```powershell
cd backend
$env:MONGO_URI = "mongodb+srv://..."
$env:ADMIN_PASSWORD = "your-admin-password"
node seed.js
```

## 2. Render backend

1. Create a Render account and choose **New > Web Service**.
2. Connect this repository and set the **Root Directory** to `backend`.
3. Use:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add these environment variables:
   - `MONGO_URI`: the Atlas connection string
   - `ADMIN_PASSWORD`: a strong admin password
   - `JWT_SECRET`: a long random secret used to sign admin sessions
   - `FRONTEND_URL`: the final Vercel URL, for example `https://nss-attendance.vercel.app`
   - `PORT`: Render supplies this automatically; leaving it unset is fine
5. Deploy and verify `https://<render-service>.onrender.com/api/health` returns `{ "status": "ok" }`.

## 3. Vercel frontend

1. Create a Vercel account and import this repository.
2. Set the **Root Directory** to `frontend`.
3. Vercel detects Vite automatically. Build command: `npm run build`.
4. Add the environment variable:
   - `VITE_API_URL=https://<render-service>.onrender.com/api`
5. Deploy. Put the resulting URL into Render's `FRONTEND_URL` variable and redeploy the backend.

The local fallback remains `http://localhost:5000/api`, so local development needs no frontend environment file. For deployment, copy `frontend/.env.example` to a Vercel environment variable instead of committing a real `.env` file.

The frontend includes a Vercel rewrite so direct meeting URLs such as `/meeting/<event-id>` open correctly when scanned from a phone. After changing the Vercel domain, create a new meeting and scan its newly generated QR code; do not use a localhost QR code.

## Operational notes

- Change the admin password before inviting volunteers.
- Keep Atlas backups enabled before storing real attendance records.
- Use HTTPS URLs for both Render and Vercel so phone geolocation works.
- The event manager enforces one open attendance session at a time.
- Admin APIs require the JWT returned by the login endpoint; do not reuse the local development JWT secret.
- The QR code and meeting URL are event-specific and remain tied to that event's timing window.
