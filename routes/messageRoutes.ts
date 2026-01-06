import {Router} from 'express';
import {
    deleteConversation,
    deleteMessage,
    editMessage,
    getConversationById,
    getConversationMessages,
    getOrCreateConversation,
    getUserConversations,
    markMessagesAsRead,
    sendMessage,
    uploadChatFile,
} from '../controllers/messageController';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission} from '../middleware/rbacMiddleware';
import {upload} from '../middleware/uploadMiddleware';

const conversationRouter = Router();
const messageRouter = Router();

conversationRouter.post('/', authenticate, checkPermission('create', 'Conversation'), getOrCreateConversation);
conversationRouter.get('/', authenticate, checkPermission('read', 'Conversation'), getUserConversations);
conversationRouter.get('/:id/messages', authenticate, checkPermission('read', 'Message'), getConversationMessages);
conversationRouter.post('/:id/messages', authenticate, checkPermission('create', 'Message'), sendMessage);
conversationRouter.get('/:id', authenticate, checkPermission('read', 'Conversation'), getConversationById);
conversationRouter.delete('/:id', authenticate, checkPermission('delete', 'Conversation'), deleteConversation);
messageRouter.post('/upload-file', authenticate, checkPermission('create', 'Message'), upload.single('file'), uploadChatFile);
messageRouter.post('/upload-image', authenticate, checkPermission('create', 'Message'), upload.single('file'), uploadChatFile); // Backward compatibility
messageRouter.put('/read', authenticate, checkPermission('update', 'Message'), markMessagesAsRead);
messageRouter.put('/:id', authenticate, checkPermission('update', 'Message'), editMessage);
messageRouter.delete('/:id', authenticate, checkPermission('delete', 'Message'), deleteMessage);

export {conversationRouter, messageRouter};
export default conversationRouter;
