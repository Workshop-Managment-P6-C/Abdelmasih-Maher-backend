// Vercel serverless entrypoint: re-exports the Express app.
// src/app.js only calls app.listen() when run directly, so importing it here
// is side-effect free and safe for serverless invocations.
const app = require('../src/app');

module.exports = app;
