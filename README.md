# NSS Smart Attendance

A web-based attendance system for NSS meetings. Volunteers check in from their phones using a meeting link or QR code, a rotating attendance code, and GPS location. Admins manage meetings, monitor attendance, review suspicious submissions, and export reports.

## What the project does

### Volunteer check-in

- Opens a meeting-specific link such as `/meeting/<event-id>`.
- Shows the correct meeting name and venue.
- Requests phone location permission.
- Records latitude, longitude, GPS accuracy, device identifier, and distance from the venue.
- Verifies the five-minute rotating attendance code.
- Blocks duplicate attendance for the same volunteer and meeting.
- Marks attendance as `present` or `needs_review`.
- Shows a clear result after submission.

### Admin features

- Password login with JWT sessions.
- Live attendance dashboard.
- Current rotating five-minute code.
- Meeting-specific QR code and shareable link.
- Create meetings with date, time, GPS coordinates, venue, and geofence radius.
- Use the admin device's current GPS location when creating a meeting.
- Preview the meeting location on a map.
- Accept or reject `needs_review` attendance with a reason.
- View device IDs only in authenticated admin views.
- Download event CSV reports.
- View cumulative student attendance and NSS hours.
- Export the cumulative directory as CSV.
- Close a meeting and prevent later check-ins.

## Project structure

```text
smart-attendance/
  backend/       Express API, MongoDB models, attendance rules
  frontend/      React/Vite web application
  README.md      This guide
  DEPLOYMENT.md  MongoDB Atlas, Render, and Vercel deployment guide
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB running locally, or a MongoDB Atlas connection
- HTTPS for production phone GPS access

## Local setup

Open two PowerShell terminals.

### 1. Configure and run the backend

```powershell
cd C:\Users\Sridhar\smart-attendance\backend
npm install
Copy-Item .env.example .env
```

For local MongoDB, edit `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart-attendance
ADMIN_PASSWORD=admin123
JWT_SECRET=local-development-secret-change-before-deploy
FRONTEND_URL=http://localhost:5173
```

Start the API:

```powershell
npm run dev
```

The backend should be available at `http://localhost:5000`.

Check it with:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Expected response:

```json
{"status":"ok"}
```

### 2. Configure and run the frontend

In the second terminal:

```powershell
cd C:\Users\Sridhar\smart-attendance\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend should be available at `http://localhost:5173`.

Important: use `cd frontend`, not `cd front end`.

## Backend-to-frontend connection

The frontend connects to the backend through `VITE_API_URL`.

Local frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Production frontend environment variable:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

The backend must allow the frontend origin through `FRONTEND_URL`:

```env
FRONTEND_URL=http://localhost:5173
```

For production:

```env
FRONTEND_URL=https://your-vercel-app.vercel.app
```

If the frontend shows network errors, check these three things:

1. Backend is running on port `5000`.
2. `VITE_API_URL` points to the correct backend.
3. `FRONTEND_URL` matches the browser frontend URL exactly.

## First admin workflow

1. Open `http://localhost:5173/admin`.
2. Enter the value of `ADMIN_PASSWORD`.
3. Open **Meetings**.
4. Click **Use my current location**, or enter coordinates manually.
5. Check the map preview and choose a radius.
6. Create the meeting.
7. Copy the generated meeting link or show its QR code.
8. Return to **Live dashboard**.
9. Display the five-minute attendance code to volunteers.
10. Review and accept or reject suspicious check-ins.
11. Download the CSV before closing the meeting.

## Volunteer workflow

1. Scan the meeting QR code or open its meeting link.
2. Allow location access.
3. Enter student details and the current five-minute code.
4. Submit attendance.
5. The system checks the event window, code, GPS distance, duplicate attendance, and device reuse.

## Testing and validation

Backend tests:

```powershell
cd backend
npm test
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Frontend lint:

```powershell
npm run lint
```

## Seed data warning

`backend/seed.js` clears users, events, and attendance before creating sample data. Use it only for a new development database. Never run it against a production database containing real attendance records.

## Deployment

Read [DEPLOYMENT.md](DEPLOYMENT.md) for the complete MongoDB Atlas, Render, and Vercel instructions.

### GitHub Pages

GitHub Pages can host the React frontend, but it cannot run the Express backend or MongoDB. The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

Before using it:

1. Deploy the backend to Render first.
2. In GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Open **Settings > Secrets and variables > Actions > Variables**.
4. Add `VITE_API_URL` with the public backend URL, for example:

```text
https://your-render-service.onrender.com/api
```

5. Push to `main` or run the workflow manually.
6. Open:

```text
https://sridharvw.github.io/smart-attendance/
```

The workflow builds from `frontend/`, so GitHub Pages will no longer display the repository README. Use the trailing slash in the URL. Meeting links must include the repository path, for example `/smart-attendance/meeting/<event-id>`.

Production variables:

### Render backend

```env
MONGO_URI=mongodb+srv://...
ADMIN_PASSWORD=use-a-strong-password
JWT_SECRET=use-a-long-random-secret
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Vercel frontend

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

Generate QR codes only after deploying the frontend. A QR generated from `localhost` will not work on another phone.

## Completion status

### Already implemented

- Volunteer check-in with meeting-specific links and QR codes.
- Five-minute rotating attendance codes.
- GPS distance and geofence checks.
- Device reuse detection and admin-only device visibility.
- Needs-review workflow with authenticated accept/reject actions and reasons.
- JWT-protected admin APIs.
- Meeting creation, closing, scheduling, and automatic time-window checks.
- Current-location capture and OpenStreetMap location preview.
- Live dashboard, cumulative directory, NSS hours, and CSV exports.
- Vercel rewrite for refreshing direct `/meeting/<event-id>` URLs.
- Backend health endpoint and basic automated tests.

### Still required before official production use

- Create the MongoDB Atlas, Render, and Vercel accounts.
- Replace all example environment values with real production secrets.
- Set a strong `ADMIN_PASSWORD` and a long random `JWT_SECRET`.
- Configure `MONGO_URI` to the Atlas database and restrict Atlas network access.
- Deploy the backend and verify `/api/health`.
- Deploy the frontend with the Render URL in `VITE_API_URL`.
- Put the final Vercel URL in Render's `FRONTEND_URL` and redeploy the backend.
- Enable Atlas backups and confirm a restore procedure.
- Test QR scanning, direct links, GPS permission, valid/invalid codes, duplicate attendance, needs review, accept/reject, CSV download, and event closing on a real phone.
- Do not run `backend/seed.js` against a production database because it deletes existing data.

### Recommended future improvements

- Add API integration tests using a separate test database.
- Add login rate limiting and password reset/admin user management.
- Add an audit log for admin actions.
- Add CSV student import and certificate/PDF reports.
- Add automatic cleanup or retention rules for old rotating codes.

## Ready-to-paste AI audit prompt

Paste the following into another AI together with this repository:

```text
You are auditing the NSS Smart Attendance project for production deployment.

Read README.md, DEPLOYMENT.md, backend/README.md, frontend/README.md, all backend routes/controllers/models, and all frontend pages. Compare the implementation with the README completion status.

Do not assume a feature is complete because documentation says it is. Verify the code and run the available tests/build commands. Report:

1. What is implemented and working.
2. What is incomplete, broken, insecure, or only configured locally.
3. Exact files and code paths responsible for each issue.
4. The safest order to fix the issues.
5. Exact MongoDB Atlas, Render, Vercel, and environment-variable steps still required.
6. A final real-phone test checklist for QR links, GPS, rotating codes, duplicate attendance, needs review, accept/reject, CSV export, and closing meetings.

Make code changes when needed, keep changes focused, and run backend tests plus the frontend production build after editing.
```
