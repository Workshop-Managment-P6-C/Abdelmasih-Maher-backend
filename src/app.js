const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const coursesRoutes = require('./routes/courses.routes');
const tasksRoutes = require('./routes/tasks.routes');
const assessmentsRoutes = require('./routes/assessments.routes');
const enrollmentsRoutes = require('./routes/enrollments.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const certificatesRoutes = require('./routes/certificates.routes');
const hallsRoutes = require('./routes/halls.routes');
const customersRoutes = require('./routes/customers.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const baysRoutes = require('./routes/bays.routes');
const bayBookingsRoutes = require('./routes/bay-bookings.routes');
const workItemsRoutes = require('./routes/work-items.routes');
const partsRoutes = require('./routes/parts.routes');
const stockRoutes = require('./routes/stock.routes');
const purchaseOrdersRoutes = require('./routes/purchase-orders.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const dashboardsRoutes = require('./routes/dashboards.routes');
const exportsRoutes = require('./routes/exports.routes');
const predictionsRoutes = require('./routes/predictions.routes');
const attachmentsRoutes = require('./routes/attachments.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const studentsRoutes = require('./routes/students.routes');
const jobCardRoutes = require('./routes/jobCard.routes');

app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'docs', 'swagger.html'));
});

app.get('/api-docs/openapi.yaml', (req, res) => {
  res.type('text/yaml').sendFile(path.join(__dirname, '..', 'docs', 'openapi.yaml'));
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend server is running correctly!',
  });
});

// Canonical API mounts (all under /api)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/assessments', assessmentsRoutes);
app.use('/api/v1/enrollments', enrollmentsRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/certificates', certificatesRoutes);
app.use('/api/v1/halls', hallsRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/vehicles', vehiclesRoutes);
app.use('/api/v1/bays', baysRoutes);
app.use('/api/v1/bay-bookings', bayBookingsRoutes);
app.use('/api/v1/work-items', workItemsRoutes);
app.use('/api/v1/parts', partsRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/purchase-orders', purchaseOrdersRoutes);
app.use('/api/v1/invoices', invoicesRoutes);
app.use('/api/v1/sessions', sessionsRoutes);
app.use('/api/v1/dashboards', dashboardsRoutes);
app.use('/api/v1/exports', exportsRoutes);
app.use('/api/v1/predictions', predictionsRoutes);
app.use('/api/v1/attachments', attachmentsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/students', studentsRoutes);
// Legacy alias (old clients)
app.use('/api/v1/job-cards', jobCardRoutes);

// 404 for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found`, requestId: `req_${Date.now()}` },
  });
});

// Central error handler (catches async errors forwarded via next(err))
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const isInvalidJson = err instanceof SyntaxError && err.status === 400 && 'body' in err;
  const status = isInvalidJson ? 400 : (err.statusCode || err.status || 500);
  const code = isInvalidJson ? 'BAD_REQUEST' : (err.code || 'INTERNAL_SERVER_ERROR');
  const message = isInvalidJson ? 'Invalid JSON body. Check commas, quotes, and braces.' : (err.message || 'Internal server error');
  res.status(status).json({
    error: {
      code,
      message,
      requestId: `req_${Date.now()}`,
    },
  });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
