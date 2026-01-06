import dotenv from 'dotenv';
import {RtmTokenBuilder} from 'agora-token';

dotenv.config();

export const agoraConfig = {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
};

export const isAgoraConfigured = (): boolean => {
    return !!(agoraConfig.appId && agoraConfig.appCertificate);
};

/**
 * Generate Agora RTM token for real-time messaging
 * @param userId - User ID (must be string, max 64 characters)
 * @param expireTimeInSeconds - Token expiration time in seconds (default: 24 hours = 86400 seconds)
 * @returns RTM token string
 */
export const generateRtmToken = (userId: string, expireTimeInSeconds: number = 86400): string => {
    if (!isAgoraConfigured()) {
        throw new Error(
            'Agora is not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables.'
        );
    }

    const uid = String(userId).substring(0, 64);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expireTimestamp = currentTimestamp + expireTimeInSeconds;

    const token = RtmTokenBuilder.buildToken(
        agoraConfig.appId,
        agoraConfig.appCertificate,
        uid,
        expireTimestamp
    );

    return token;
};

/**
 * Generate Agora RTC token for video calls (if needed)
 * @param channelName - Channel name
 * @param userId - User ID (must be string or number)
 * @param expireTimeInSeconds - Token expiration time in seconds (default: 24 hours)
 * @returns RTC token string
 */
export const generateRtcToken = (
    channelName: string,
    userId: string | number,
    expireTimeInSeconds: number = 86400
): string => {
    if (!isAgoraConfigured()) {
        throw new Error(
            'Agora is not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables.'
        );
    }

    const {RtcTokenBuilder, RtcRole} = require('agora-token');
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;
    const uid = typeof userId === 'number' ? userId : parseInt(String(userId).replace(/\D/g, '')) || 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
        agoraConfig.appId,
        agoraConfig.appCertificate,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs
    );

    return token;
};

