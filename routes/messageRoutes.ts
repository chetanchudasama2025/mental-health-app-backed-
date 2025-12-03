import { Router } from 'express';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  deleteConversation,
} from '../controllers/messageController';
import { authenticate } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/rbacMiddleware';

const conversationRouter = Router();
const messageRouter = Router();

conversationRouter.post('/', authenticate, checkPermission('create', 'Conversation'), getOrCreateConversation);
conversationRouter.get('/', authenticate, checkPermission('read', 'Conversation'), getUserConversations);
conversationRouter.get('/:id', authenticate, checkPermission('read', 'Conversation'), getConversationById);
conversationRouter.delete('/:id', authenticate, checkPermission('delete', 'Conversation'), deleteConversation);
conversationRouter.get('/:id/messages', authenticate, checkPermission('read', 'Message'), getConversationMessages);
conversationRouter.post('/:id/messages', authenticate, checkPermission('create', 'Message'), sendMessage);
messageRouter.put('/read', authenticate, checkPermission('update', 'Message'), markMessagesAsRead);
messageRouter.delete('/:id', authenticate, checkPermission('delete', 'Message'), deleteMessage);

export { conversationRouter, messageRouter };
export default conversationRouter;
