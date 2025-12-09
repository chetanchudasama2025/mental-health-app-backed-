import {Router} from 'express';
import {
  createNotification,
  deleteNotification,
  getAllNotifications,
  getNotificationById,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotification,
} from '../controllers/notificationController';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticate, requireRole('admin'), checkPermission('create', 'Notification'), createNotification);
router.get('/', authenticate, checkPermission('read', 'Notification'), getAllNotifications);
router.get('/unread/count', authenticate, checkPermission('read', 'Notification'), getUnreadNotificationCount);
router.get('/:id', authenticate, checkPermission('read', 'Notification'), getNotificationById);
router.put('/:id', authenticate, checkPermission('update', 'Notification'), updateNotification);
router.patch('/:id/read', authenticate, checkPermission('update', 'Notification'), markNotificationAsRead);
router.patch('/read/all', authenticate, checkPermission('update', 'Notification'), markAllNotificationsAsRead);
router.delete('/:id', authenticate, checkPermission('delete', 'Notification'), deleteNotification);

export default router;

