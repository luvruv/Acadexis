import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT current_database() AS database, current_user AS user_name, version() AS server_version"
  );
  console.log("Connected to PostgreSQL:", rows[0]);
} catch (error) {
  console.error("Connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}