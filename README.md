# Exercise Tracker Microservice (SQLite)

## Endpoints

- `POST /api/users` → Create user
- `GET /api/users` → Get all users
- `POST /api/users/:_id/exercises` → Add exercise
- `GET /api/users/:_id/logs?from=&to=&limit=` → Get logs

## Setup

```bash
npm install
npm start
```

Database will be created as `exercise.db`.
