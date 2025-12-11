import {Router} from 'express';
import {
  cancelBooking,
  createBooking,
  deleteBooking,
  getAllBookings,
  getBookingById,
  getBookingsByTherapist,
  getMyBookings,
  processPaymentAndCreateBooking,
  updateBooking
} from '../controllers/bookingController';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post('/process-payment-and-create-booking', authenticate, processPaymentAndCreateBooking);
router.post('/', authenticate, checkPermission('create', 'Booking'), createBooking);
router.get('/', authenticate, requireRole('admin'), getAllBookings);
router.get('/my-bookings', authenticate, getMyBookings);
router.get('/therapist/:therapistId', authenticate, checkPermission('read', 'Booking'), getBookingsByTherapist);
router.get('/:id', authenticate, getBookingById);
router.put('/:id', authenticate, checkPermission('update', 'Booking'), updateBooking);
router.patch('/:id/cancel', authenticate, checkPermission('update', 'Booking'), cancelBooking);
router.delete('/:id', authenticate, requireRole('admin'), checkPermission('delete', 'Booking'), deleteBooking);

export default router;

