-- ============================================================================
-- Smart Local Bus Route Finder  -  Analytical Queries
-- These are the statistical queries that power the dashboard. They can be run
-- directly in psql against the seeded database.
-- Group: Abdul Rafay (2412182), Varun Sainani (2412222)
-- ============================================================================

-- 1. Dashboard KPIs ----------------------------------------------------------
SELECT
  (SELECT count(*) FROM stop)                                  AS total_stops,
  (SELECT count(*) FROM route WHERE is_active)                 AS total_routes,
  (SELECT round(sum(length_km)) FROM route)                    AS network_km,
  (SELECT count(*) FROM passenger)                             AS total_passengers,
  (SELECT count(*) FROM journey)                               AS total_journeys,
  (SELECT sum(fare) FROM journey)                              AS total_revenue,
  (SELECT round(avg(rating), 2) FROM feedback)                 AS avg_rating,
  (SELECT round(100.0 * avg((on_time)::int), 1) FROM trip_log) AS on_time_pct;

-- 2. Ridership and revenue per route (bar) -----------------------------------
SELECT r.code, r.name, count(j.journey_id) AS rides, sum(j.fare) AS revenue
FROM route r
LEFT JOIN journey j ON j.route_id = r.route_id
GROUP BY r.code, r.name
ORDER BY rides DESC;

-- 3. Ridership share by service type (doughnut) ------------------------------
SELECT rt.name AS type, count(j.journey_id) AS rides
FROM route_type rt
JOIN route r ON r.route_type_id = rt.route_type_id
JOIN journey j ON j.route_id = r.route_id
GROUP BY rt.name
ORDER BY rides DESC;

-- 4. Daily ridership over the last 30 days (line) ----------------------------
SELECT board_time::date AS day, count(*) AS rides
FROM journey
WHERE board_time >= CURRENT_DATE - INTERVAL '29 days'
GROUP BY day
ORDER BY day;

-- 5. Passenger distribution by hour of day (area) ----------------------------
SELECT extract(hour FROM board_time)::int AS hour, count(*) AS rides
FROM journey
GROUP BY hour
ORDER BY hour;

-- 6. Top 10 busiest stops by boardings (horizontal bar) ----------------------
SELECT s.name, count(j.journey_id) AS boardings
FROM stop s
JOIN journey j ON j.board_stop_id = s.stop_id
GROUP BY s.name
ORDER BY boardings DESC
LIMIT 10;

-- 7. Fleet composition by fuel type (pie) ------------------------------------
SELECT bm.fuel_type, count(b.bus_id) AS buses
FROM bus b
JOIN bus_model bm ON bm.bus_model_id = b.bus_model_id
GROUP BY bm.fuel_type
ORDER BY buses DESC;

-- 8. Top up revenue by payment method (doughnut) -----------------------------
SELECT payment_method, count(*) AS txns, sum(amount) AS total
FROM card_transaction
WHERE txn_type = 'TopUp'
GROUP BY payment_method
ORDER BY total DESC;

-- 9. On-time performance per route (bar) -------------------------------------
SELECT r.code, round(100.0 * avg((tl.on_time)::int), 1) AS on_time_pct,
       count(tl.trip_log_id) AS trips
FROM route r
JOIN schedule sc ON sc.route_id = r.route_id
JOIN trip_log tl ON tl.schedule_id = sc.schedule_id
GROUP BY r.code
ORDER BY on_time_pct DESC;

-- 10. Average rating per route (bar) -----------------------------------------
SELECT r.code, round(avg(fb.rating), 2) AS avg_rating, count(*) AS responses
FROM route r
JOIN feedback fb ON fb.route_id = r.route_id
GROUP BY r.code
ORDER BY avg_rating DESC;

-- 11. Most searched destinations (horizontal bar) ----------------------------
SELECT f.name AS from_stop, t.name AS to_stop, count(*) AS searches
FROM route_search rs
JOIN stop f ON f.stop_id = rs.from_stop_id
JOIN stop t ON t.stop_id = rs.to_stop_id
GROUP BY f.name, t.name
ORDER BY searches DESC
LIMIT 10;

-- 12. Incidents grouped by type (bar) ----------------------------------------
SELECT incident_type, count(*) AS total
FROM incident
GROUP BY incident_type
ORDER BY total DESC;
