# Deployment

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
