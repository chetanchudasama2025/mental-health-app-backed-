import {Router} from 'express';
import {
  createTherapist,
  deleteTherapist,
  getAllTherapists,
  getApprovedTherapists,
  getTherapistById,
  getTherapistByUserId,
  updateTherapist,
  updateTherapistStatus,
} from '../controllers/therapistController';
import {authenticate} from '../middleware/authMiddleware';
import {upload} from '../middleware/uploadMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'videoIntro', maxCount: 1 },
  { name: 'educationPhotos', maxCount: 10 },
  { name: 'certificationPhotos', maxCount: 10 },
  { name: 'experiencePhotos', maxCount: 10 },
]);

router.post(
  '/',
  authenticate,
  requireRole('therapist'),
  checkPermission('create', 'Therapist'),
  uploadFields,
  createTherapist
);
router.get('/', getAllTherapists);
router.get('/approved', getApprovedTherapists);
router.get('/:id', getTherapistById);
router.get('/user/:userId', getTherapistByUserId);
router.put(
  '/:id',
  authenticate,
  checkPermission('update', 'Therapist'),
  upload.any(),
  updateTherapist
);
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'superAdmin'),
  checkPermission('update', 'Therapist'),
  updateTherapistStatus
);
router.delete('/:id', authenticate, requireRole('admin'), checkPermission('delete', 'Therapist'), deleteTherapist);

export default router;

