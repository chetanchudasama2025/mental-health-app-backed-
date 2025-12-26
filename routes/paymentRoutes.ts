import {Router} from 'express';
import {
    createPayment,
    deletePayment,
    getAllPayments,
    getMyPayments,
    getPaymentById,
    getPaymentsByUserId,
    updatePayment,
} from '../controllers/paymentController';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticate, requireRole('patient'), checkPermission('create', 'Payment'), createPayment);
router.get('/', authenticate, requireRole('admin'), getAllPayments);
router.get('/me', authenticate, getMyPayments);
router.get('/user/:userId', authenticate, getPaymentsByUserId);
router.get('/:id', authenticate, checkPermission('read', 'Payment'), getPaymentById);
router.put('/:id', authenticate, checkPermission('update', 'Payment'), updatePayment);
router.patch('/:id', authenticate, checkPermission('update', 'Payment'), updatePayment);
router.delete('/:id', authenticate, requireRole('admin'), checkPermission('delete', 'Payment'), deletePayment);

export default router;

