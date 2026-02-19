# Smart Attendance System

Full-stack attendance management platform with role-based dashboards for admin, teacher, and student users.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express + MongoDB + Socket.IO

## Project Structure
- `frontend/` - React client
- `Server/` - API and real-time server

## Local Setup
1. Create `Server/.env` from `Server/.env.example`.
2. Create `frontend/.env` from `frontend/.env.example`.
3. Install dependencies:
   - `cd Server && npm install`
   - `cd ../frontend && npm install`
4. Start backend:
   - `cd Server && npm run dev`
5. Start frontend:
   - `cd frontend && npm run dev`

## Production Notes
- Backend health endpoint: `GET /health`
- Configure backend `CORS_ORIGINS` to your frontend domain.
- Render deployment blueprint is defined in `render.yaml`.
- Deployment steps: `DEPLOY_RENDER.md`

## Pre-Upload Checklist
1. Run frontend lint and build:
   - `cd frontend && npm run lint`
   - `cd frontend && npm run build`
2. Validate backend entry file syntax:
   - `cd Server && node --check index.js`
3. Confirm environment files:
   - `Server/.env` has Mongo URI, JWT secret, and CORS origins.
   - `frontend/.env` points `VITE_API_BASE_URL` to deployed backend URL.
4. Push project to GitHub and deploy using `render.yaml`.
