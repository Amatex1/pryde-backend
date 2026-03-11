# Pryde Social - Deployment Guide

## Production Architecture

- **Frontend**: Vercel
- **Backend API**: Render web service
- **Database**: MongoDB Atlas
- **Primary frontend origin**: `https://prydeapp.com`
- **Primary API origin**: `https://api.prydeapp.com`

The frontend should call the backend **directly** on the API domain in production so auth cookies stay aligned with the `prydeapp.com` root domain.

## Backend Source of Truth

The repo includes a Render blueprint at `render.yaml`, but the live Render dashboard service is the operational source of truth and should stay aligned with the repo.

Current live backend service settings:

- Branch: `main`
- Root directory: `server`
- Build command: `npm install && node scripts/update-version.js`
- Start command: `node server.js`
- Region: `singapore`
- Public URL: `https://pryde-backend.onrender.com`

Core env values that should remain consistent across docs, the dashboard, and the app:

- `BASE_URL=https://pryde-backend.onrender.com`
- `FRONTEND_URL=https://prydeapp.com`
- `API_DOMAIN=https://api.prydeapp.com`
- `ROOT_DOMAIN=prydeapp.com`

Important: the Render dashboard remains the live source of truth for secret values and service settings.

## Frontend Source of Truth

The frontend deployment is Vercel-based.

Preferred production env:

```env
VITE_API_DOMAIN=https://api.prydeapp.com
```

Only use `VITE_API_URL` or `VITE_SOCKET_URL` as temporary overrides.

Optional media/CDN env alignment:

```env
VITE_CDN_URL=https://media.prydeapp.com
R2_ENABLED=true
R2_PUBLIC_URL=https://media.prydeapp.com
```

If `VITE_CDN_URL` is set in Vercel, keep it aligned with backend `R2_PUBLIC_URL` so media URLs resolve consistently.

## Recommended Deployment Flow

### 1. Validate locally

Backend:

```bash
cd server
npm run lint
npm test
```

Frontend:

```bash
npm test
npm run build
```

### 2. Merge through GitHub with CI enabled

- Backend required checks should include:
  - `Run Tests`
  - `Lint Code`
  - `Runtime Smoke Check`
  - `All Required Checks Passed`
- Frontend required checks should include:
  - `Run Frontend Tests`
  - `Build Frontend`
  - `All Required Frontend Checks Passed`

### 3. Let providers deploy from Git

- Render auto-deploys the backend from the configured branch
- Vercel auto-deploys the frontend from the configured branch

Avoid manual file upload workflows. They are no longer the supported production path.

## Post-Deploy Verification

### Backend
- `GET https://pryde-backend.onrender.com/api/health`
- `GET https://pryde-backend.onrender.com/api/version`
- If `api.prydeapp.com` is configured, verify the same endpoints there

### Frontend
- `https://prydeapp.com` loads cleanly
- `https://www.prydeapp.com` behaves correctly if used
- No critical console errors

### Auth/session checks
- Login works from the production frontend origin
- Refresh works without mixed cookie scope
- Logout clears the refresh cookie

## Rollback Plan

- Use the previous successful Render deploy if the backend regresses
- Use the previous successful Vercel deployment if the frontend regresses
- Keep database backups outside the app repos

## Secret Hygiene

- Never commit `.env`, exported provider env dumps, or certificate/key files
- Avoid keeping plaintext env exports loose in the workspace
- If a secret file is discovered, rotate the credentials rather than only deleting the file

## Troubleshooting

### CORS failures
- Confirm `FRONTEND_URL` matches the production frontend origin
- Confirm the frontend is served over HTTPS

### Cookie/session failures
- Confirm `API_DOMAIN` is `https://api.prydeapp.com`
- Confirm `ROOT_DOMAIN` is `prydeapp.com`
- Confirm the frontend is using `VITE_API_DOMAIN`

### Frontend can reach Render URL but auth is flaky
- Remove reliance on proxy-based auth calls in production
- Keep auth traffic pointed at `https://api.prydeapp.com`

