# Smart Local Bus Route Finder

A database-driven analytical dashboard and route planner for Karachi's public bus network.
Built as the Database Systems final semester project.

**Group:** Abdul Rafay (2412182) and Varun Sainani (2412222)
**Program:** BS Computer Science, SZABIST University, Karachi

The system stores Karachi's BRT and feeder bus network in a PostgreSQL database, exposes it
through a Node.js and Express REST API, and presents meaningful insights on a single Bootstrap
dashboard with Chart.js. An integrated route finder computes the cheapest journey across the
network using Dijkstra's shortest path algorithm and draws it on a live map.

## Live demo

- Dashboard: _added after deployment_
- API health: _added after deployment_/api/health

## Features

**Analytical dashboard (single page)**
- 8 key performance indicator cards (routes, stops, network km, riders, journeys, revenue, rating, on-time percent)
- 13 charts covering bar, horizontal bar, line, area, pie, and doughnut types
- Ridership by route, modal split, daily ridership and revenue trends, peak hours, busiest stops,
  fleet fuel mix, payment methods, on-time performance, ratings, popular destinations, and incidents

**Route finder**
- Pick an origin and destination from the live stop list
- Dijkstra shortest path over a (route, stop) graph with automatic transfer detection
- Per-leg fare and time, total fare, total time, number of stops, and transfers
- Each leg drawn in its route colour on a Leaflet and OpenStreetMap map

## Technology stack

| Layer | Technology |
| --- | --- |
| Database | PostgreSQL 16 on Neon |
| Backend | Node.js, Express.js, node-postgres |
| Frontend | HTML, CSS, Bootstrap 5, JavaScript (Fetch / AJAX) |
| Charts | Chart.js 4 |
| Map | Leaflet with OpenStreetMap |
| Hosting | Vercel |

## Database

21 tables across three areas, with primary keys, foreign keys, unique and check constraints,
and indexes. Seeded with more than 22,000 sample rows (including 6,000 passenger journeys).

- **Network:** zone, operator, route_type, route, stop, route_stop, fare_stage
- **Fleet and operations:** bus_model, bus, driver, staff, schedule, trip_log, maintenance
- **Passengers and revenue:** passenger, fare_card, card_transaction, journey, route_search, feedback, incident

## Project structure

```
smart-bus-route-finder/
  api/            Vercel serverless entry (reuses the Express app)
  backend/        Express API: db pool, routes (analytics, finder, crud), seed scripts
  public/         Bootstrap dashboard, charts, route finder, API testing console
  database/       schema.sql, queries.sql, full_dump.sql
  docs/           report (PDF), presentation (PDF), ERD and class diagrams
  screenshots/    dashboard and API testing screenshots
  vercel.json     single project: static dashboard + /api serverless function
```

## Run locally

1. Install dependencies

   ```bash
   cd backend && npm install
   ```

2. Create `backend/.env` with your Neon connection string

   ```
   PORT=4000
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
   ```

3. Create the schema and seed the data

   ```bash
   node db/run-sql.js ../database/schema.sql
   node db/seed.js
   ```

4. Start the server and open the dashboard

   ```bash
   npm start
   # http://localhost:4000          dashboard
   # http://localhost:4000/api/health
   # http://localhost:4000/api-explorer.html   API testing console
   ```

Alternatively, restore the full database from the SQL script:

```bash
psql "$DATABASE_URL" -f database/full_dump.sql
```

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /api/health | Service and database health |
| GET | /api/analytics/summary | KPI values |
| GET | /api/analytics/* | 13 analytical endpoints (ridership, revenue, peak hours, ...) |
| GET | /api/finder/stops | All stops |
| GET | /api/finder/plan?from=&to= | Plan a journey (Dijkstra) |
| GET/POST/PUT/DELETE | /api/{resource}/:id | CRUD for routes, stops, passengers, drivers, operators, buses, feedback, incidents |

## Deliverables

See `docs/SUBMISSION-CHECKLIST.md` for the mapping of each required submission item to its file.
