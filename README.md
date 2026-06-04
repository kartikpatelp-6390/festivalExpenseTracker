# Festival Expense Tracker

Converted workspace for the existing Festival Expense Tracker.

- `api/`: Flask API with MySQL-ready SQLAlchemy models.
- `ui/`: React + Vite UI using Tailwind and shadcn-style components.

The endpoint names intentionally mirror the previous Express API under `/api`.

## API

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask --app run run --host 0.0.0.0 --port 5000
```

## Alembic

The models are mapped to the existing MySQL schema from phpMyAdmin. If you are creating a fresh database, run:

```bash
cd api
alembic upgrade head
```

If your MySQL tables already exist and match the migration, mark the database as current instead:

```bash
cd api
alembic stamp head
```

## UI

```bash
cd ui
npm install
cp .env.example .env.local
npm run dev
```

For local development, Vite reads `ui/.env.local`, which is ignored by git. Set
`VITE_API_BASE_URL` differently per environment, for example your live host can
provide its own value during deploy/build.
