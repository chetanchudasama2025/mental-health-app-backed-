import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  deleteUser,
  deleteCurrentUser,
} from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', createUser);
router.get('/me', authenticate, getCurrentUser);
router.delete('/me', authenticate, deleteCurrentUser);
router.get('/', authenticate, requireRole('admin'), getAllUsers);
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, updateUser);
router.delete('/:id', authenticate, requireRole('admin'), deleteUser);

export default router;

