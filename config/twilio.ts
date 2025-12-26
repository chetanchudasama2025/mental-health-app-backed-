import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
    console.warn('Twilio credentials are not fully configured. Phone verification and SMS reminders will not work.');
    console.warn('Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
}

export const twilioClient = accountSid && authToken
    ? twilio(accountSid, authToken)
    : null;

export const twilioConfig = {
    accountSid,
    authToken,
    phoneNumber,
};

export const isTwilioConfigured = (): boolean => {
    return !!(twilioClient && phoneNumber);
};

export const sendOTP = async (to: string, otp: string): Promise<void> => {
    if (!twilioClient || !phoneNumber) {
        throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
    }

    try {
        await twilioClient.messages.create({
            body: `Your Mental Health App verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code with anyone.`,
            from: phoneNumber,
            to: to,
        });
    } catch (error) {
        console.error('Twilio SMS sending error:', error);
        throw new Error('Failed to send verification SMS');
    }
};

