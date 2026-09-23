const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/wst',
});

// Non-blocking connectivity check: never crash the server if DB is down.
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL database:', err.message);
    console.error('   Check DATABASE_URL and that Postgres (wst db) is running.');
    return;
  }
  console.log(' Connected successfully to PostgreSQL database!');
  release();
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
