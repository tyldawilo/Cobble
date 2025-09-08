# Cobble MVP Monorepo

This monorepo contains the Cobble MVP services:

- apps/web: Next.js 14 frontend (App Router, TS, Tailwind)
- services/ai: FastAPI (Python 3.11) AI compute service
- supabase: Local Supabase config and SQL migrations

## Prerequisites
- Node 20.x (use `.nvmrc`)
- npm
- Python 3.11 + pip
- Docker + Docker Compose
- Supabase CLI (for local dev)

## Getting Started

1. Install dependencies
```bash
npm install
```

2. Start Supabase (CLI)
```bash
npm run supabase:start
npm run db:reset
# optional: sync env to web
npm run supabase:link-web-env
```

3. Run web (dev)
```bash
npm run dev --workspace=web
```

4. AI service (dev)
```bash
cd services/ai
pip install -r requirements.txt
uvicorn app.main:app --reload
```

5. Docker Compose (all services)
```bash
docker compose up --build
```

## Turbo
Use Turbo to run pipeline tasks across workspaces.

```bash
npm run dev
npm run build
npm run lint
npm run test
```
