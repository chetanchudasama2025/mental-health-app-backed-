import { Router } from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getUser,
  changePassword,
  verifyEmail,
  sendVerificationEmailAPI,
  resendVerificationEmail,
  sendVerificationPhoneAPI,
  verifyPhone,
  resendVerificationPhone,
  googleAuth,
  googleCallback,
} from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, changePassword);
router.post('/send-verification-email', sendVerificationEmailAPI);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);
router.post('/send-verification-phone', sendVerificationPhoneAPI);
router.post('/verify-phone', verifyPhone);
router.post('/resend-verification-phone', resendVerificationPhone);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;

