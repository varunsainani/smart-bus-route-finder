# Smart Local Bus Route Finder — Database Systems Final Project

Database-driven analytical dashboard for Karachi's public bus network, built strictly to
the course guidelines. Idea taken from the Smart Bus Route Finder proposal; stack and
deliverables taken from the Database Systems Project Guidelines.

## Group
- Abdul Rafay — 2412182
- Varun Sainani — 2412222

Program: BSCS, SZABIST University, Karachi. Course: Database Systems (Final Semester Project).
Report language: English only.

## Mandatory stack (from teacher guidelines, non-negotiable)
- Database: PostgreSQL hosted on Neon.com
- Backend: Node.js + Express.js REST API (CRUD + analytical/statistical queries, JSON)
- Frontend: HTML, CSS, Bootstrap, JavaScript (Fetch/AJAX), charts on a single dashboard page
- Charts: Chart.js (bar, pie, line, doughnut, area)

## Hard requirements checklist
- [ ] ERD with a minimum of 16 tables (we ship ~21) with PKs, FKs, relationships, constraints
- [ ] Relational schema on Neon Postgres with constraints + sufficient sample data
- [ ] Express REST API: CRUD + analytics endpoints returning JSON
- [ ] Single-page Bootstrap dashboard consuming the API via fetch, with multiple chart types
- [ ] Meaningful insights surfaced from the database through the API
- [ ] Full project report (19 sections) + ERD + class diagram + SQL script + source + screenshots + presentation

## Database design (target ~21 tables, well above the 16 minimum)
Reference / network graph:
1. zone — geographic / fare zones of Karachi
2. operator — bus operators (TransKarachi, Peoples Bus Service, Sindh Mass Transit Authority)
3. route_type — lookup: BRT / Feeder / EV / Intercity (color, base fare)
4. route — a named bus service (Green Line, Red Line, R-10, EV-1)
5. stop — physical stop/station (lat, lng, zone, terminal flag)
6. route_stop — ordered stops per route (sequence, distance, time, fare from previous): the graph edges
7. fare_stage — distance-band fare rules per route_type

Fleet & operations:
8. bus_model — vehicle model (capacity, fuel type: Diesel / CNG / Electric)
9. bus — fleet vehicle (registration, model, operator, assigned route, status)
10. driver — drivers (license, operator, hire date)
11. staff — station staff (role, assigned stop)
12. schedule — scheduled trips (route, bus, driver, departure time, direction, day)
13. trip_log — completed trips (actual times, passenger count)
14. maintenance — vehicle maintenance records (type, cost)

Passengers & revenue:
15. passenger — registered app users (home zone, signup date)
16. fare_card — transit smart cards (balance, status)
17. card_transaction — top-ups / refunds (amount, method, time)
18. journey — actual passenger journeys (board/alight stop, fare, stops, transfers, time): main analytics source
19. route_search — logged in-app searches (origin, destination, result found): popular OD analytics
20. feedback — passenger ratings / complaints (rating, category, comment)
21. incident — service incidents / delays (type, severity, reported/resolved)

## Analytical dashboard (single page, Chart.js)
KPI cards: total stops, routes, network km, registered passengers, today ridership, total revenue, average rating, on-time percent.
- Bar: ridership (journeys) per route
- Horizontal bar: top 10 busiest stops by boardings; top origin to destination pairs
- Doughnut/Pie: modal split by route_type; fleet fuel mix; payment method split
- Line: daily ridership trend (last 30 days)
- Area: peak-hour passenger distribution by hour of day

## Bonus feature (the heart of the idea): live route finder
Search from stop -> to stop, run Dijkstra over the route_stop graph (weighted by time + fare),
return a step-by-step itinerary with transfers, total fare, total time, and stop count, drawn
on a free Leaflet + OpenStreetMap map (no Google key, no billing). This satisfies the original
proposal while the analytics dashboard satisfies the teacher's requirement.

## Repo layout
```
smart-bus-route-finder/
  backend/        Node + Express API, Neon pg pool, Dijkstra engine
  frontend/       index.html dashboard + route-finder, Bootstrap, Chart.js, Leaflet
  database/       schema.sql, seed.sql, queries.sql (analytics)
  docs/           ERD, class diagram, report, presentation
  screenshots/    API testing + dashboard output
```

## Deliverables (maps 1:1 to the teacher's 9 submission items)
1. Project Report (PDF, 19 sections, both names on title page)
2. ERD diagram (image)
3. Class diagram (image)
4. SQL database script
5. Node.js + Express source
6. Frontend source (HTML/CSS/JS/Bootstrap)
7. API testing screenshots
8. Dashboard output screenshots
9. Project presentation (slide deck)

## Build phases
1. Schema design -> schema.sql + ER/class diagrams
2. Provision Neon DB, run schema, seed realistic Karachi data (real BRT routes + plausible operational data)
3. Express API: CRUD per entity + analytics endpoints + Dijkstra route endpoint
4. Bootstrap dashboard (Chart.js) + route finder (Leaflet) consuming the API
5. Verify live (RAM check first), capture API + dashboard screenshots
6. Write the 19-section report, build the presentation, assemble submission folder
```
