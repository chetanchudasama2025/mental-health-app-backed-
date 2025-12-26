import {Router} from 'express';
import {
    createReview,
    deleteReview,
    getAllReviews,
    getMyReviews,
    getReviewById,
    getReviewsByTherapist,
    updateReview,
} from '../controllers/reviewController';
import {authenticate} from '../middleware/authMiddleware';
import {upload} from '../middleware/uploadMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post(
    '/',
    authenticate,
    checkPermission('create', 'Review'),
    upload.array('attachments', 5),
    createReview
);
router.get(
    '/',
    authenticate,
    requireRole('admin', 'superAdmin', 'contentModerator'),
    getAllReviews
);
router.get('/therapist/:therapistId', getReviewsByTherapist);
router.get(
    '/me',
    authenticate,
    checkPermission('read', 'Review'),
    getMyReviews
);
router.get(
    '/:id',
    authenticate,
    checkPermission('read', 'Review'),
    getReviewById
);
router.put(
    '/:id',
    authenticate,
    checkPermission('update', 'Review'),
    upload.array('attachments', 5),
    updateReview
);
router.delete(
    '/:id',
    authenticate,
    checkPermission('delete', 'Review'),
    deleteReview
);

export default router;
