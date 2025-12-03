import { Router } from 'express';
import authRoutes from './authRoutes';
import therapistRoutes from './therapistRoutes';
import userRoutes from './userRoutes';
import availabilityRoutes from './availabilityRoutes';
import supportTicketRoutes from './supportTicketRoutes';
import bookingRoutes from './bookingRoutes';
import notificationRoutes from './notificationRoutes';
import paymentRoutes from './paymentRoutes';
import { conversationRouter, messageRouter } from './messageRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/therapists', therapistRoutes);
router.use('/users', userRoutes);
router.use('/availabilities', availabilityRoutes);
router.use('/support-tickets', supportTicketRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/conversations', conversationRouter);
router.use('/messages', messageRouter);

export { router as routes };

