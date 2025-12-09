import {Router} from 'express';
import {
  createAvailability,
  deleteAvailability,
  getAllAvailabilities,
  getAvailabilityById,
  getAvailabilityByTherapistId,
  updateAvailability,
} from '../controllers/availabilityController';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticate, requireRole('therapist'), checkPermission('create', 'Availability'), createAvailability);
router.get('/', getAllAvailabilities);
router.get('/:id', getAvailabilityById);
router.get('/therapist/:therapistId', getAvailabilityByTherapistId);
router.put('/:id', authenticate, checkPermission('update', 'Availability'), updateAvailability);
router.delete('/:id', authenticate, checkPermission('delete', 'Availability'), deleteAvailability);

export default router;

