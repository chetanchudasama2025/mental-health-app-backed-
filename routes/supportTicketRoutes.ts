import { Router } from 'express';
import {
  createSupportTicket,
  getAllSupportTickets,
  getSupportTicketById,
  updateSupportTicket,
  deleteSupportTicket,
} from '../controllers/supportTicketController';
import { authenticate } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';
import { checkPermission, requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticate, checkPermission('create', 'SupportTicket'), upload.array('attachments', 10), createSupportTicket);
router.get('/', authenticate, requireRole('admin'), getAllSupportTickets);
router.get('/:id', authenticate, checkPermission('read', 'SupportTicket'), getSupportTicketById);
router.put('/:id', authenticate, checkPermission('update', 'SupportTicket'), upload.array('attachments', 10), updateSupportTicket);
router.delete('/:id', authenticate, requireRole('admin'), checkPermission('delete', 'SupportTicket'), deleteSupportTicket);

export default router;

