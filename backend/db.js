// PostgreSQL connection pool (Neon). Reused across serverless invocations.
require("dotenv").config();
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
