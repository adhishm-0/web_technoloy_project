const mongoose = require('mongoose');
const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  summary: { type: String, trim: true, maxlength: 320, default: '' },
  description: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Academic', 'Exam', 'Event', 'Holiday', 'General', 'Technical Event', 'Hackathon', 'Workshop', 'Examination', 'Placement', 'Sports'], default: 'General' },
  priority: { type: String, enum: ['Low', 'Normal', 'Medium', 'High'], default: 'Normal' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issuingDepartment: { type: String, trim: true, maxlength: 100, default: '' },
  // Images selected in the admin editor are stored as data URLs so they work in
  // both local development and serverless deployments without a separate file store.
  coverImage: { type: String, trim: true, maxlength: 3000000, default: '' },
  imageAlt: { type: String, trim: true, maxlength: 250, default: '' },
  eventStartAt: { type: Date, default: null },
  eventEndAt: { type: Date, default: null },
  isDemo: { type: Boolean, default: false, index: true },
  demoKey: { type: String, trim: true, unique: true, sparse: true },
  expiryDate: { type: Date, default: null },
  isPinned: { type: Boolean, default: false },
  status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published', index: true },
  audience: { type: String, enum: ['campus', 'targeted'], default: 'campus' },
  departments: [{ type: String, trim: true }],
  academicYears: [{ type: String, trim: true }]
}, { timestamps: true });
noticeSchema.index({ status: 1, isPinned: -1, createdAt: -1 });
noticeSchema.index({ expiryDate: 1 });
module.exports = mongoose.model('Notice', noticeSchema);
