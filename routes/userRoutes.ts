import {Router} from 'express';
import {
    acceptTermsAndPrivacy,
    createUser,
    deleteCurrentUser,
    deleteUser,
    getAllUsers,
    getCurrentUser,
    getUserById,
    getUserStatus,
    setUserPassword,
    updateOnlineStatus,
    updateUser,
} from '../controllers/userController';
import {authenticate} from '../middleware/authMiddleware';
import {requireRole} from '../middleware/rbacMiddleware';
import {upload} from '../middleware/uploadMiddleware';

const router = Router();

const uploadProfilePhoto = upload.fields([
    {name: 'profilePhoto', maxCount: 1},
]);

router.post('/', uploadProfilePhoto, createUser);
router.get('/me', authenticate, getCurrentUser);
router.post('/me/accept-terms', authenticate, acceptTermsAndPrivacy);
router.delete('/me', authenticate, deleteCurrentUser);
router.get('/', authenticate, requireRole('admin'), getAllUsers);
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, uploadProfilePhoto, updateUser);
router.post('/:id/set-password', authenticate, requireRole('admin'), setUserPassword);
router.delete('/:id', authenticate, requireRole('admin'), deleteUser);
router.put('/me/online-status', authenticate, updateOnlineStatus);
router.get('/:userId/status', authenticate, getUserStatus);

export default router;

