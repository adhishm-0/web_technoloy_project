const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken, isAdmin } = require('../middleware/auth');
const notices = require('../controllers/noticeController');

const categories = ['Academic', 'Exam', 'Event', 'Holiday', 'General', 'Technical Event', 'Hackathon', 'Workshop', 'Examination', 'Placement', 'Sports'];
const priorities = ['Low', 'Normal', 'Medium', 'High'];
const rules = [
  body('title').trim().isLength({ min: 1, max: 140 }).withMessage('Title must be 1 to 140 characters'),
  body('summary').optional().isString().trim().isLength({ max: 320 }),
  body('description').trim().isLength({ min: 1, max: 12000 }).withMessage('Description is required and must be under 12,000 characters'),
  body('category').optional().isIn(categories),
  body('priority').optional().isIn(priorities),
  body('issuingDepartment').optional().isString().trim().isLength({ max: 100 }),
  body('coverImage').optional().isString().trim().isLength({ max: 3000000 }).custom(value => !value || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || /^\/(?!\/)[\w./-]+$/.test(value)).withMessage('Photo must be a JPG, PNG, or WebP image under 2 MB'),
  body('imageAlt').optional().isString().trim().isLength({ max: 250 }),
  body('eventStartAt').optional({ nullable: true }).isISO8601().withMessage('Event start must be a valid date and time'),
  body('eventEndAt').optional({ nullable: true }).isISO8601().withMessage('Event end must be a valid date and time'),
  body('expiryDate').optional({ nullable: true }).isISO8601(),
  body('isPinned').optional().isBoolean(),
  body('status').optional().isIn(['published', 'draft', 'archived']),
  body('audience').optional().isIn(['campus', 'targeted']),
  body('departments').optional().isArray({ max: 30 }),
  body('departments.*').optional().isString().trim().isLength({ max: 80 }),
  body('academicYears').optional().isArray({ max: 20 }),
  body('academicYears.*').optional().isString().trim().isLength({ max: 40 })
];

router.use(verifyToken);
router.get('/bookmarks', notices.bookmarks);
router.get('/unread/count', notices.unreadCount);
router.get('/featured', notices.featured);
router.get('/', notices.list);
router.put('/:id/bookmark', notices.toggleBookmark);
router.post('/:id/read', notices.markRead);
router.get('/:id', notices.get);
router.post('/', isAdmin, rules, notices.create);
router.put('/:id', isAdmin, rules, notices.update);
router.delete('/:id', isAdmin, notices.remove);
module.exports = router;
