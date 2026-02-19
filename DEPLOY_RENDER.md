# Deploy On Render

## 1) Push latest code
```bash
git add .
git commit -m "Add Render deployment config"
git push
```

## 2) Create services from Blueprint
1. Open Render Dashboard.
2. Click `New` -> `Blueprint`.
3. Select this repo: `brijeshkumar2024/Smart-Attendance`.
4. Render will detect `render.yaml` and create:
   - `smart-attendance-api` (Node web service)
   - `smart-attendance-frontend` (Static site)

## 3) Set backend environment variables
In Render -> `smart-attendance-api` -> `Environment`, add:
- `MONGO_URI`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

`NODE_ENV=production` is already set by `render.yaml`.
`CORS_ORIGINS` is auto-linked from frontend `RENDER_EXTERNAL_URL` by `render.yaml`.
If you use a custom frontend domain, update `CORS_ORIGINS` manually to that domain.

## 4) Deploy
1. Trigger deploy for backend first.
2. Then deploy frontend.

Frontend uses:
- `VITE_API_BASE_URL` from backend `RENDER_EXTERNAL_URL` automatically.
- `VITE_SOCKET_URL` from backend `RENDER_EXTERNAL_URL` automatically.

## 5) Verify
1. Backend health: open `https://<backend-url>/health`, should return JSON with `"status":"ok"`.
2. Open frontend URL and login.
