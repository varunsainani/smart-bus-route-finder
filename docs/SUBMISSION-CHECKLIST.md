# Submission Checklist

Database Systems Final Semester Project
Group: Abdul Rafay (2412182) and Varun Sainani (2412222)

Mapping of each required submission item to the file that satisfies it.

| # | Required item | File in this project |
| --- | --- | --- |
| 1 | Complete Project Report (PDF) | `docs/report.pdf` (23 pages, 19 sections) |
| 2 | ERD Diagram | `docs/diagrams/erd.png` (source: `docs/diagrams/erd.html`) |
| 3 | Class Diagram | `docs/diagrams/class.png` (source: `docs/diagrams/class.html`) |
| 4 | SQL Database Script | `database/schema.sql` (DDL) and `database/full_dump.sql` (schema + data) |
| 5 | Node.js and Express Source Code | `backend/` and `api/index.js` |
| 6 | Frontend Source Code (HTML, CSS, JS) | `public/` |
| 7 | Screenshots of API Testing | `screenshots/04-api-testing.png`, `screenshots/06-api-crud-methods.png` |
| 8 | Screenshots of Dashboard Output | `screenshots/01-dashboard-top.png`, `02-dashboard-full.png`, `03-route-finder.png`, `07-dashboard-mobile.png` |
| 9 | Complete Project Presentation | `docs/presentation.pdf` (12 slides) |

## Requirement compliance

- ERD contains 21 tables (minimum required: 16).
- Analytical dashboard present, single page, multiple chart types (bar, line, area, pie, doughnut).
- PostgreSQL hosted on Neon.
- REST API with Node.js and Express performing CRUD and returning analytical data as JSON.
- Dashboard consumes the API using JavaScript Fetch / AJAX.
- Additional analytical query reference: `database/queries.sql`.

## Bonus

- Live route finder using Dijkstra's shortest path algorithm with transfer detection and a map.
- API testing console at `public/api-explorer.html`.
