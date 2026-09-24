const toJson = (v) => {
  if (typeof v !== 'string') return JSON.stringify(v);
  try { JSON.parse(v); return v; } catch { return JSON.stringify({ en: v }); }
};
const uid = (req) => (req.user ? req.user.userId : null);
module.exports = { toJson, uid };
