import {Router} from 'express';
import {
    addPassword,
    changePassword,
    forgotPassword,
    getUser,
    googleAuth,
    googleCallback,
    login,
    refreshToken,
    register,
    resendVerificationEmail,
    resendVerificationPhone,
    resetPassword,
    sendVerificationEmailAPI,
    sendVerificationPhoneAPI,
    verifyEmail,
    verifyPhone,
} from '../controllers/authController';
import {authenticate} from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticate, getUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, changePassword);
router.post('/add-password', authenticate, addPassword);
router.post('/send-verification-email', sendVerificationEmailAPI);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);
router.post('/send-verification-phone', sendVerificationPhoneAPI);
router.post('/verify-phone', verifyPhone);
router.post('/resend-verification-phone', resendVerificationPhone);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;

