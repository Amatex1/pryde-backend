# Pryde Social - Deployment Guide

## Production Architecture

- **Frontend**: Vercel
- **Backend API**: Render web service
- **Database**: MongoDB Atlas
- **Primary frontend origin**: `https://prydeapp.com`
- **Primary API origin**: `https://api.prydeapp.com`

The frontend should call the backend **directly** on the API domain in production so auth cookies stay aligned with the `prydeapp.com` root domain.

## Backend Source of Truth

The checked-in Render blueprint lives at `render.yaml` and should include:

- `BASE_URL=https://pryde-backend.onrender.com`
- `FRONTEND_URL=https://prydeapp.com`
- `API_DOMAIN=https://api.prydeapp.com`
- `ROOT_DOMAIN=prydeapp.com`

Important: the Render dashboard remains the live source of truth for secret values.

## Frontend Source of Truth

The frontend deployment is Vercel-based.

Preferred production env:

```env
VITE_API_DOMAIN=https://api.prydeapp.com
```

Only use `VITE_API_URL` or `VITE_SOCKET_URL` as temporary overrides.

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

