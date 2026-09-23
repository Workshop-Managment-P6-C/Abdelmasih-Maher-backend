const toJson = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const uid = (req) => (req.user ? req.user.userId : null);
module.exports = { toJson, uid };
