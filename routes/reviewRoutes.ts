import {Router} from 'express';
import {
  createReview,
  getAllReviews,
  getReviewById,
  getReviewsByTherapist,
  getMyReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController';
import {authenticate} from '../middleware/authMiddleware';
import {upload} from '../middleware/uploadMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

// Create a new review (authenticated users)
router.post(
  '/',
  authenticate,
  checkPermission('create', 'Review'),
  upload.array('attachments', 5),
  createReview
);

// Get all reviews (with filters) - admins and moderators
router.get(
  '/',
  authenticate,
  requireRole('admin', 'superAdmin', 'contentModerator'),
  getAllReviews
);

// Get reviews by therapist ID (public endpoint for approved reviews)
router.get('/therapist/:therapistId', getReviewsByTherapist);

// Get current user's reviews
router.get(
  '/me',
  authenticate,
  checkPermission('read', 'Review'),
  getMyReviews
);

// Get a single review by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('read', 'Review'),
  getReviewById
);

// Update review (reviewer can update their own pending reviews, admins can update any)
router.put(
  '/:id',
  authenticate,
  checkPermission('update', 'Review'),
  upload.array('attachments', 5),
  updateReview
);

// Delete review (soft delete)
router.delete(
  '/:id',
  authenticate,
  checkPermission('delete', 'Review'),
  deleteReview
);

export default router;
