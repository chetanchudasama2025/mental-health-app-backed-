import {Router} from 'express';
import {
    createSupportTicket,
    deleteSupportTicket,
    getAllSupportTickets,
    getSupportTicketById,
    getSupportTicketByTicketNumber,
    updateSupportTicket,
} from '../controllers/supportTicketController';
import {authenticate} from '../middleware/authMiddleware';
import {upload} from '../middleware/uploadMiddleware';
import {checkPermission, requireRole} from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticate, checkPermission('create', 'SupportTicket'), upload.array('attachments', 10), createSupportTicket);
router.get('/', authenticate, requireRole('admin'), getAllSupportTickets);
router.get('/ticket/:ticketNumber', authenticate, checkPermission('read', 'SupportTicket'), getSupportTicketByTicketNumber);
router.get('/:id', authenticate, checkPermission('read', 'SupportTicket'), getSupportTicketById);
router.put('/:id', authenticate, checkPermission('update', 'SupportTicket'), upload.array('attachments', 10), updateSupportTicket);
router.delete('/:id', authenticate, requireRole('admin'), checkPermission('delete', 'SupportTicket'), deleteSupportTicket);

export default router;

