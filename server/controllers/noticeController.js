const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const NoticeRead = require('../models/NoticeRead');
const Bookmark = require('../models/Bookmark');
const { validationResult } = require('express-validator');
const { visibleNoticeFilter } = require('../utils/audience');
const { audit, notifyNotice } = require('../utils/records');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { const error = new Error(errors.array()[0].msg); error.status = 400; throw error; }
}
function safeSearch(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasValidEventRange(fields, current = {}) {
  const start = fields.eventStartAt ?? current.eventStartAt;
  const end = fields.eventEndAt ?? current.eventEndAt;
  return !end || (start && new Date(end) >= new Date(start));
}
function editableFields(body) {
  const keys = ['title', 'summary', 'description', 'category', 'priority', 'issuingDepartment', 'coverImage', 'imageAlt', 'eventStartAt', 'eventEndAt', 'expiryDate', 'isPinned', 'status', 'audience', 'departments', 'academicYears'];
  return Object.fromEntries(keys.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
}
function filtersFor(req) {
  const filter = req.user.role === 'admin' ? {} : visibleNoticeFilter(req.user);
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.department && req.user.role === 'admin') filter.departments = { $in: [String(req.query.department).slice(0, 80)] };
  if (req.query.search) {
    const search = safeSearch(String(req.query.search).slice(0, 120));
    const text = { $or: [{ title: { $regex: search, $options: 'i' } }, { summary: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }] };
    if (filter.$and) filter.$and.push(text); else Object.assign(filter, text);
  }
  if (req.query.status && req.user.role === 'admin' && ['published', 'draft', 'archived'].includes(req.query.status)) filter.status = req.query.status;
  return filter;
}
async function decorate(notices, userId) {
  const ids = notices.map(notice => notice._id);
  if (!ids.length) return notices;
  const [reads, bookmarks] = await Promise.all([
    NoticeRead.find({ user: userId, notice: { $in: ids } }).select('notice').lean(),
    Bookmark.find({ user: userId, notice: { $in: ids } }).select('notice').lean()
  ]);
  const readIds = new Set(reads.map(item => String(item.notice)));
  const bookmarkIds = new Set(bookmarks.map(item => String(item.notice)));
  return notices.map(notice => {
    const data = notice.toObject ? notice.toObject() : notice;
    data.isRead = readIds.has(String(notice._id));
    data.isBookmarked = bookmarkIds.has(String(notice._id));
    return data;
  });
}
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const sortMap = { newest: { isPinned: -1, createdAt: -1 }, oldest: { createdAt: 1 } };
    const filter = filtersFor(req);
    if (req.query.unread === 'true') {
      const readIds = await NoticeRead.find({ user: req.user._id }).distinct('notice');
      const unreadFilter = { _id: { $nin: readIds } };
      if (filter.$and) filter.$and.push(unreadFilter); else Object.assign(filter, unreadFilter);
    }
    const publicFilter = req.user.role === 'admin' ? { $or: [{ status: 'published' }, { status: { $exists: false } }] } : visibleNoticeFilter(req.user);
    const now = new Date();
    const getNotices = async () => {
      if (req.query.sort === 'priority') {
        const rows = await Notice.aggregate([
          { $match: filter },
          { $addFields: { priorityRank: { $switch: { branches: [{ case: { $eq: ['$priority', 'High'] }, then: 4 }, { case: { $eq: ['$priority', 'Medium'] }, then: 3 }, { case: { $eq: ['$priority', 'Normal'] }, then: 2 }], default: 1 } } } },
          { $sort: { isPinned: -1, priorityRank: -1, createdAt: -1 } },
          { $skip: (page - 1) * limit }, { $limit: limit }
        ]);
        return Notice.populate(rows, { path: 'postedBy', select: 'name' });
      }
      if (req.query.sort === 'expiry') {
        const rows = await Notice.aggregate([
          { $match: filter },
          { $addFields: { expiryRank: { $cond: [{ $ifNull: ['$expiryDate', false] }, 0, 1] } } },
          { $sort: { expiryRank: 1, expiryDate: 1, createdAt: -1 } },
          { $skip: (page - 1) * limit }, { $limit: limit }
        ]);
        return Notice.populate(rows, { path: 'postedBy', select: 'name' });
      }
      return Notice.find(filter).populate('postedBy', 'name').sort(sortMap[req.query.sort] || sortMap.newest).skip((page - 1) * limit).limit(limit);
    };
    const [total, notices, categoryCounts, pinnedCount, expiringSoon] = await Promise.all([
      Notice.countDocuments(filter),
      getNotices(),
      Notice.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Notice.countDocuments({ ...publicFilter, isPinned: true }),
      Notice.countDocuments({ ...publicFilter, expiryDate: { $gte: now, $lte: new Date(Date.now() + 7 * 86400000) } })
    ]);
    res.json({ success: true, data: await decorate(notices, req.user._id), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, categoryCounts, pinnedCount, expiringSoon });
  } catch (error) { next(error); }
}
async function featured(req, res, next) {
  try {
    const notice = await Notice.findOne({ ...visibleNoticeFilter(req.user), isPinned: true })
      .populate('postedBy', 'name')
      .sort({ createdAt: -1 });
    const data = notice ? (await decorate([notice], req.user._id))[0] : null;
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
async function get(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Notice not found.' });
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, ...visibleNoticeFilter(req.user) };
    const notice = await Notice.findOne(filter).populate('postedBy', 'name');
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    await NoticeRead.updateOne({ notice: notice._id, user: req.user._id }, { $setOnInsert: { readAt: new Date() } }, { upsert: true });
    const [decorated] = await decorate([notice], req.user._id);
    res.json({ success: true, data: decorated });
  } catch (error) { next(error); }
}
async function create(req, res, next) {
  try {
    validate(req);
    const fields = editableFields(req.body);
    if (!hasValidEventRange(fields)) return res.status(400).json({ success: false, message: 'Set an event start time before its end time.' });
    if (fields.audience === 'targeted' && !fields.departments?.length && !fields.academicYears?.length) return res.status(400).json({ success: false, message: 'Choose at least one department or academic year for a targeted notice.' });
    const notice = await Notice.create({ ...fields, postedBy: req.user._id });
    await audit(req.user, notice.status === 'draft' ? 'notice.created' : 'notice.published', 'notice', notice._id, notice.title);
    if (notice.status === 'published') { try { await notifyNotice(notice); } catch (error) { console.error('Notice notification failed:', error.message); } }
    res.status(201).json({ success: true, message: notice.status === 'draft' ? 'Draft saved' : 'Notice published', data: notice });
  } catch (error) { next(error); }
}
async function update(req, res, next) {
  try {
    validate(req);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Notice not found.' });
    const before = await Notice.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Notice not found.' });
    const fields = editableFields(req.body);
    if (!hasValidEventRange(fields, before)) return res.status(400).json({ success: false, message: 'Set an event start time before its end time.' });
    const audience = fields.audience ?? before.audience;
    const departments = fields.departments ?? before.departments;
    const academicYears = fields.academicYears ?? before.academicYears;
    if (audience === 'targeted' && !departments?.length && !academicYears?.length) return res.status(400).json({ success: false, message: 'Choose at least one department or academic year for a targeted notice.' });
    const notice = await Notice.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    await audit(req.user, before.status !== notice.status ? `notice.${notice.status}` : 'notice.updated', 'notice', notice._id, notice.title);
    if (before.status !== 'published' && notice.status === 'published') { try { await notifyNotice(notice); } catch (error) { console.error('Notice notification failed:', error.message); } }
    res.json({ success: true, message: 'Notice updated', data: notice });
  } catch (error) { next(error); }
}
async function remove(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Notice not found.' });
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    await Promise.all([NoticeRead.deleteMany({ notice: notice._id }), Bookmark.deleteMany({ notice: notice._id })]);
    await audit(req.user, 'notice.deleted', 'notice', notice._id, notice.title);
    res.json({ success: true, message: 'Notice deleted', data: notice });
  } catch (error) { next(error); }
}
async function toggleBookmark(req, res, next) {
  try {
    const notice = await Notice.findOne({ _id: req.params.id, ...visibleNoticeFilter(req.user) }).select('_id');
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    const existing = await Bookmark.findOne({ notice: notice._id, user: req.user._id });
    if (existing) { await existing.deleteOne(); return res.json({ success: true, data: { isBookmarked: false } }); }
    await Bookmark.create({ notice: notice._id, user: req.user._id });
    res.json({ success: true, data: { isBookmarked: true } });
  } catch (error) { next(error); }
}
async function markRead(req, res, next) {
  try {
    const notice = await Notice.findOne({ _id: req.params.id, ...visibleNoticeFilter(req.user) }).select('_id');
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    await NoticeRead.updateOne({ notice: notice._id, user: req.user._id }, { $setOnInsert: { readAt: new Date() } }, { upsert: true });
    res.json({ success: true, data: { isRead: true } });
  } catch (error) { next(error); }
}
async function unreadCount(req, res, next) {
  try {
    const result = await Notice.aggregate([
      { $match: visibleNoticeFilter(req.user) },
      { $lookup: { from: NoticeRead.collection.name, let: { noticeId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$notice', '$$noticeId'] }, { $eq: ['$user', req.user._id] }] } } }, { $limit: 1 }], as: 'readReceipt' } },
      { $match: { readReceipt: { $size: 0 } } },
      { $count: 'count' }
    ]);
    res.json({ success: true, data: { count: result[0]?.count || 0 } });
  } catch (error) { next(error); }
}
async function bookmarks(req, res, next) {
  try {
    const rows = await Bookmark.find({ user: req.user._id }).sort({ createdAt: -1 }).populate({ path: 'notice', populate: { path: 'postedBy', select: 'name' } });
    const notices = rows.map(row => row.notice).filter(Boolean);
    const visibleIds = req.user.role === 'admin' ? null : new Set((await Notice.find(visibleNoticeFilter(req.user)).select('_id')).map(notice => String(notice._id)));
    const visible = visibleIds ? notices.filter(notice => visibleIds.has(String(notice._id))) : notices;
    res.json({ success: true, data: await decorate(visible, req.user._id) });
  } catch (error) { next(error); }
}

module.exports = { list, featured, get, create, update, remove, toggleBookmark, markRead, unreadCount, bookmarks };
