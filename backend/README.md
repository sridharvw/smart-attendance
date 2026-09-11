# NSS Smart Attendance Backend

Express and MongoDB API for the NSS Smart Attendance application.

## Responsibilities

- Admin login and JWT session creation.
- Meeting creation, scheduling, closing, and public meeting lookup.
- Five-minute rotating attendance codes.
- GPS distance and geofence validation.
- Duplicate and shared-device detection.
- Attendance review and accept/reject operations.
- Event CSV and cumulative directory data.
- Health check for deployment monitoring.

## Install

```powershell
cd C:\Users\Sridhar\smart-attendance\backend
npm install
Copy-Item .env.example .env
```

## Environment variables

For local MongoDB:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart-attendance
ADMIN_PASSWORD=admin123
JWT_SECRET=local-development-secret-change-before-deploy
FRONTEND_URL=http://localhost:5173
```

For deployment, use a MongoDB Atlas URI and a strong random `JWT_SECRET`.

Do not commit `.env` files. Use `.env.example` as the template.

## Run

Development with automatic restart:

```powershell
npm run dev
```

Production start:

```powershell
npm start
```

API URL:

```text
http://localhost:5000
```

Health check:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

## Main endpoints

Public:

- `GET /api/health`
- `POST /api/admin/login`
- `GET /api/events/active`
- `GET /api/events/:eventId/public`
- `POST /api/attendance/mark`

Admin JWT required:

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:eventId/code`
- `PATCH /api/events/:eventId/close`
- `GET /api/attendance/live/:eventId`
- `PATCH /api/attendance/:attendanceId/status`
- `GET /api/attendance/directory`
- `GET /api/attendance/export/:eventId`

Admin requests must include:

```http
Authorization: Bearer <jwt-token>
```

## Database

MongoDB must be running before the backend starts.

Local MongoDB:

```text
mongodb://127.0.0.1:27017/smart-attendance
```

MongoDB Atlas:

```text
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/smart-attendance
```

The seed script is destructive. It deletes existing users, events, and attendance records:

```powershell
node seed.js
```

Only use it with a new development database.

## Tests

```powershell
npm test
```

The current tests cover authentication middleware and GPS distance calculation. Before a large production rollout, add full API integration tests against a test database.
