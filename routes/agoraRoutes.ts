import {Router} from 'express';
import {authenticate} from '../middleware/authMiddleware';
import {checkPermission} from '../middleware/rbacMiddleware';
import {
    generateRtmTokenController,
    getAgoraConfig,
} from '../controllers/agoraController';

const agoraRouter = Router();

agoraRouter.get('/config', authenticate, getAgoraConfig);
agoraRouter.post(
    '/rtm-token',
    authenticate,
    checkPermission('read', 'Message'),
    generateRtmTokenController
);

export default agoraRouter;

