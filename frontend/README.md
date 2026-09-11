# NSS Smart Attendance Frontend

React/Vite frontend for volunteers and NSS administrators.

## Pages

- `/` - volunteer check-in for the active meeting.
- `/meeting/<event-id>` - volunteer check-in for one specific meeting link or QR code.
- `/admin` - live attendance dashboard.
- `/admin/events` - create meetings, choose GPS coordinates, preview the map, and generate links/QR codes.
- `/admin/directory` - cumulative volunteer attendance, NSS hours, device IDs, and CSV export.

## Install and run

```powershell
cd C:\Users\Sridhar\smart-attendance\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Backend connection

The frontend uses `VITE_API_URL` to find the Express backend.

Local `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Production Vercel variable:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

The backend must be running and must allow the frontend URL with its `FRONTEND_URL` variable.

## Commands

```powershell
npm run dev
npm run build
npm run lint
npm run preview
```

The Vercel rewrite in `vercel.json` allows direct mobile navigation to `/meeting/<event-id>` after scanning a QR code.

Do not create QR codes from `localhost` for real volunteers. Create them from the deployed Vercel URL.
