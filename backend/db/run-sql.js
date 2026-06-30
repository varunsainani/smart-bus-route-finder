// Apply a .sql file to the database. Usage: node db/run-sql.js ../database/schema.sql
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node db/run-sql.js <file.sql>");
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(file), "utf8");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Applying ${path.basename(file)} ...`);
  await client.query(sql);
  console.log("Done.");
  await client.end();
})().catch((e) => {
  console.error("SQL error:", e.message);
  process.exit(1);
});
