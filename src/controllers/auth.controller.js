const authService = require('../services/auth.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');

const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await authService.login(email, password);
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, req, error);
  }
});

const register = asyncHandler(async (req, res) => {
  try {
    const user = await authService.register(req.body || {});
    return res.status(201).json({ success: true, user });
  } catch (error) {
    return sendError(res, req, error);
  }
});

const refresh = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const result = await authService.refresh(refreshToken);
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, req, error);
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body || {};
    const result = await authService.forgotPassword(email);
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, req, error);
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body || {};
    const result = await authService.resetPassword(resetToken, newPassword);
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, req, error);
  }
});

const getMe = asyncHandler(async (req, res) => {
  try {
    const user = await authService.findUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', requestId: `req_${Date.now()}` } });
    return res.status(200).json(user);
  } catch (error) {
    return sendError(res, req, error);
  }
});

const getUsers = asyncHandler(async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return sendError(res, req, error);
  }
});

const getUserById = asyncHandler(async (req, res) => {
  try {
    const user = await authService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', requestId: `req_${Date.now()}` } });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return sendError(res, req, error);
  }
});

const updateUser = asyncHandler(async (req, res) => {
  try {
    const updated = await authService.updateUser(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', requestId: `req_${Date.now()}` } });
    return res.status(200).json({ success: true, user: updated });
  } catch (error) {
    return sendError(res, req, error);
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  try {
    const deleted = await authService.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', requestId: `req_${Date.now()}` } });
    return res.status(200).json({ success: true, message: 'User deactivated' });
  } catch (error) {
    return sendError(res, req, error);
  }
});

module.exports = {
  login,
  register,
  refresh,
  forgotPassword,
  resetPassword,
  getMe,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
