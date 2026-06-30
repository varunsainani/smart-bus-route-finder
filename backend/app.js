// Express application for the Smart Local Bus Route Finder REST API.
// Exported as a module so it can run locally (server.js) or on Vercel (api/index.js).
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const analytics = require("./routes/analytics");
const routefinder = require("./routes/routefinder");
const { mountAll, RESOURCES } = require("./routes/crud");

const app = express();
app.use(cors());
app.use(express.json());

// health check
app.get("/api/health", async (req, res) => {
  try {
    const r = await db.query("SELECT now() AS time, version() AS pg");
    res.json({ status: "ok", db: "connected", time: r.rows[0].time });
  } catch (e) {
    res.status(500).json({ status: "error", db: "disconnected", message: e.message });
  }
});

// API index (handy for the report and quick testing)
app.get("/api", (req, res) => {
  res.json({
    name: "Smart Local Bus Route Finder API",
    group: "Abdul Rafay (2412182), Varun Sainani (2412222)",
    endpoints: {
      health: "GET /api/health",
      crud: Object.keys(RESOURCES).map((r) => `/api/${r}`),
      analytics: [
        "/api/analytics/summary",
        "/api/analytics/ridership-by-route",
        "/api/analytics/busiest-stops",
        "/api/analytics/modal-split",
        "/api/analytics/fleet-fuel-mix",
        "/api/analytics/payment-methods",
        "/api/analytics/daily-ridership",
        "/api/analytics/daily-revenue",
        "/api/analytics/peak-hours",
        "/api/analytics/top-od-pairs",
        "/api/analytics/rating-by-route",
        "/api/analytics/on-time-performance",
        "/api/analytics/incidents-by-type",
      ],
      route_finder: ["GET /api/finder/stops", "GET /api/finder/plan?from={id}&to={id}"],
    },
  });
});

// mount analytics, finder, and all CRUD resources
app.use("/api/analytics", analytics);
app.use("/api/finder", routefinder);
mountAll(app);

// serve the static dashboard in local dev (on Vercel this is handled by @vercel/static)
app.use(express.static(path.join(__dirname, "..", "public")));

module.exports = app;
