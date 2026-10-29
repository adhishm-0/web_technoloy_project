const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const result = (res, data, message = 'Success') => res.json({ success: true, message, data });
function validate(req) { const errors = validationResult(req); if (!errors.isEmpty()) { const e = new Error(errors.array()[0].msg); e.status = 400; throw e; } }
function tokenFor(user) { return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' }); }
async function register(req, res, next) {
  try { validate(req); const { name, email, password } = req.body;
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'user' });
    result(res, { token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }, 'Account created');
  } catch (e) { next(e); }
}
async function login(req, res, next) {
  try { validate(req); const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    if (req.path === '/admin-login' && user.role !== 'admin') return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
    result(res, { token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }, 'Signed in');
  } catch (e) { next(e); }
}
async function changePassword(req, res, next) {
  try { validate(req); const user = await User.findById(req.user._id);
    if (!(await bcrypt.compare(req.body.currentPassword, user.password))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(req.body.newPassword, 12); await user.save(); result(res, null, 'Password changed');
  } catch (e) { next(e); }
}
module.exports = { register, login, changePassword };
