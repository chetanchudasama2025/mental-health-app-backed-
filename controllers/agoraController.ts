import {NextFunction, Response} from 'express';
import {AuthRequest} from '../middleware/authMiddleware';
import {generateRtmToken, isAgoraConfigured} from '../config/agora';

/**
 * Generate Agora RTM token for real-time messaging
 */
export const generateRtmTokenController = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!isAgoraConfigured()) {
            res.status(200).json({
                success: false,
                message: 'Agora RTM service is not configured. Please configure AGORA_APP_ID and AGORA_APP_CERTIFICATE.',
                data: {
                    token: null,
                    userId: req.user!._id.toString(),
                    isConfigured: false,
                },
            });
            return;
        }

        const userId = req.user!._id.toString();

        try {
            const expireTimeInSeconds = 86400; // 24 hours
            const token = generateRtmToken(userId, expireTimeInSeconds);
            const expiresAt = new Date(Date.now() + expireTimeInSeconds * 1000).toISOString();

            res.status(200).json({
                success: true,
                message: 'RTM token generated successfully',
                data: {
                    token,
                    userId,
                    expireTimeInSeconds,
                    expiresAt,
                    isConfigured: true,
                },
            });
        } catch (tokenError: any) {
            console.error('RTM token generation error:', tokenError);
            res.status(200).json({
                success: false,
                message: 'Failed to generate RTM token. Please check Agora configuration.',
                data: {
                    token: null,
                    userId,
                    isConfigured: false,
                    error: process.env.NODE_ENV === 'development' ? tokenError.message : undefined,
                },
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Get Agora configuration (App ID only, no sensitive data)
 */
export const getAgoraConfig = async (
    _req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {agoraConfig} = require('../config/agora');

        res.status(200).json({
            success: true,
            message: 'Agora configuration retrieved successfully',
            data: {
                appId: agoraConfig.appId,
                isConfigured: isAgoraConfigured(),
            },
        });
    } catch (error) {
        next(error);
    }
};

