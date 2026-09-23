// Shared HTTP helpers: unified error shape { error: { code, message, requestId } }
// and an async wrapper so rejected promises never hang Express 4.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const requestId = (req) => req.id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function sendError(res, req, err) {
  const status = err.statusCode || 500;
  const code = err.code || (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : status < 500 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
  // PG unique-violation -> 409, FK-violation -> 400
  let message = err.message || 'Internal server error';
  let finalStatus = status;
  let finalCode = code;
  if (err.code === '23505' || /duplicate|already exists|unique/i.test(message)) { finalStatus = 409; finalCode = 'CONFLICT'; }
  if (err.code === '23503' || /foreign key|violates/i.test(message)) { finalStatus = 400; finalCode = 'VALIDATION_ERROR'; }
  return res.status(finalStatus).json({ error: { code: finalCode, message, requestId: requestId(req) } });
}

module.exports = { asyncHandler, sendError, requestId };
