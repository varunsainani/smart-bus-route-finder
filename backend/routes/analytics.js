// Analytical / statistical endpoints. Each returns JSON ready for Chart.js.
const express = require("express");
const db = require("../db");
const router = express.Router();

const send = (res, p) => p.then((r) => res.json(r.rows)).catch((e) => res.status(500).json({ error: e.message }));

// KPI cards for the top of the dashboard
router.get("/summary", async (req, res) => {
  try {
    const q = (s) => db.query(s).then((r) => r.rows[0]);
    const [a, b, c, d, e, f, g, h] = await Promise.all([
      q(`SELECT
           (SELECT count(*)::int FROM stop)                     AS total_stops,
           (SELECT count(*)::int FROM route WHERE is_active)    AS total_routes,
           (SELECT count(*)::int FROM passenger)                AS total_passengers,
           (SELECT count(*)::int FROM journey)                  AS total_journeys`),
      q(`SELECT round(coalesce(sum(length_km),0))::int AS network_km FROM route`),
      q(`SELECT coalesce(sum(fare),0)::int AS total_revenue FROM journey`),
      q(`SELECT count(*)::int AS today_ridership FROM journey WHERE board_time::date = CURRENT_DATE`),
      q(`SELECT round(avg(rating)::numeric,2) AS avg_rating FROM feedback`),
      q(`SELECT round(100.0*avg(CASE WHEN on_time THEN 1 ELSE 0 END),1) AS on_time_pct FROM trip_log`),
      q(`SELECT count(*)::int AS active_buses FROM bus WHERE status='Active'`),
      q(`SELECT count(*)::int AS open_incidents FROM incident WHERE resolved_at IS NULL`),
    ]);
    res.json({ ...a, ...b, ...c, ...d, ...e, ...f, ...g, ...h });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bar: ridership and revenue per route
router.get("/ridership-by-route", (req, res) => send(res, db.query(
  `SELECT r.code, r.name, rt.color_hex AS color,
          count(j.journey_id)::int AS rides,
          coalesce(sum(j.fare),0)::int AS revenue
   FROM route r
   JOIN route_type rt ON rt.route_type_id = r.route_type_id
   LEFT JOIN journey j ON j.route_id = r.route_id
   GROUP BY r.code, r.name, rt.color_hex
   ORDER BY rides DESC`)));

// Horizontal bar: top 10 busiest stops by boardings
router.get("/busiest-stops", (req, res) => send(res, db.query(
  `SELECT s.name, count(j.journey_id)::int AS boardings
   FROM stop s JOIN journey j ON j.board_stop_id = s.stop_id
   GROUP BY s.name ORDER BY boardings DESC LIMIT 10`)));

// Doughnut: ridership share by service type
router.get("/modal-split", (req, res) => send(res, db.query(
  `SELECT rt.name AS type, rt.color_hex AS color, count(j.journey_id)::int AS rides
   FROM route_type rt
   JOIN route r ON r.route_type_id = rt.route_type_id
   JOIN journey j ON j.route_id = r.route_id
   GROUP BY rt.name, rt.color_hex ORDER BY rides DESC`)));

// Pie: fleet composition by fuel type
router.get("/fleet-fuel-mix", (req, res) => send(res, db.query(
  `SELECT bm.fuel_type, count(b.bus_id)::int AS buses
   FROM bus b JOIN bus_model bm ON bm.bus_model_id = b.bus_model_id
   GROUP BY bm.fuel_type ORDER BY buses DESC`)));

// Doughnut: card top-up revenue by payment method
router.get("/payment-methods", (req, res) => send(res, db.query(
  `SELECT payment_method, count(*)::int AS txns, coalesce(sum(amount),0)::int AS total
   FROM card_transaction WHERE txn_type='TopUp' AND payment_method IS NOT NULL
   GROUP BY payment_method ORDER BY total DESC`)));

// Line: daily ridership over the last 30 days
router.get("/daily-ridership", (req, res) => send(res, db.query(
  `SELECT to_char(board_time::date,'YYYY-MM-DD') AS day, count(*)::int AS rides
   FROM journey
   WHERE board_time >= CURRENT_DATE - INTERVAL '29 days'
   GROUP BY board_time::date ORDER BY board_time::date`)));

// Area: daily fare revenue over the last 30 days
router.get("/daily-revenue", (req, res) => send(res, db.query(
  `SELECT to_char(board_time::date,'YYYY-MM-DD') AS day, coalesce(sum(fare),0)::int AS revenue
   FROM journey
   WHERE board_time >= CURRENT_DATE - INTERVAL '29 days'
   GROUP BY board_time::date ORDER BY board_time::date`)));

// Area: passenger distribution by hour of day
router.get("/peak-hours", (req, res) => send(res, db.query(
  `SELECT extract(hour FROM board_time)::int AS hour, count(*)::int AS rides
   FROM journey GROUP BY hour ORDER BY hour`)));

// Horizontal bar: most searched origin to destination pairs
router.get("/top-od-pairs", (req, res) => send(res, db.query(
  `SELECT f.name AS from_stop, t.name AS to_stop, count(*)::int AS searches
   FROM route_search rs
   JOIN stop f ON f.stop_id = rs.from_stop_id
   JOIN stop t ON t.stop_id = rs.to_stop_id
   GROUP BY f.name, t.name ORDER BY searches DESC LIMIT 10`)));

// Bar: average passenger rating per route
router.get("/rating-by-route", (req, res) => send(res, db.query(
  `SELECT r.code, round(avg(fb.rating)::numeric,2) AS avg_rating, count(fb.feedback_id)::int AS responses
   FROM route r JOIN feedback fb ON fb.route_id = r.route_id
   GROUP BY r.code ORDER BY avg_rating DESC`)));

// Bar: on-time performance per route
router.get("/on-time-performance", (req, res) => send(res, db.query(
  `SELECT r.code, round(100.0*avg(CASE WHEN tl.on_time THEN 1 ELSE 0 END),1) AS on_time_pct,
          count(tl.trip_log_id)::int AS trips
   FROM route r
   JOIN schedule sc ON sc.route_id = r.route_id
   JOIN trip_log tl ON tl.schedule_id = sc.schedule_id
   GROUP BY r.code ORDER BY on_time_pct DESC`)));

// Bar: incidents grouped by type
router.get("/incidents-by-type", (req, res) => send(res, db.query(
  `SELECT incident_type, count(*)::int AS total
   FROM incident GROUP BY incident_type ORDER BY total DESC`)));

module.exports = router;
