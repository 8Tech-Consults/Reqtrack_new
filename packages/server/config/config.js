import mysql from "mysql2/promise";

const port = 9000;
const host = "localhost";
const baseUrl = `http://${host}:${port}/logos/`;
const imagesUrl = `http://${host}:2222`;
const test = "testing123";
const MAX_RESULTS = 1000;
const PRIVATE_KEY = "tredumo_lower@2025";

// Create connection pool
const db = mysql.createPool({
  host: "localhost",
  socketPath: process.env.MYSQL_SOCKET_PATH || undefined,
  user: "root",
  database: "reqtrack_new",
  password: "",
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
});

// Verify connection
try {
  const connection = await db.getConnection();
  console.log("Database connection established successfully");
  connection.release();
} catch (error) {
  console.error("Database connection failed:", error.message);
  process.exit(1); // Exit process with failure code
}

export { baseUrl, port, db, host, MAX_RESULTS, imagesUrl, PRIVATE_KEY };
