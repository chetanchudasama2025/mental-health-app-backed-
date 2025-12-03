import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Encryption key - Must match the frontend encryption key
 * IMPORTANT: In production, this should be stored securely in environment variables
 * and should match the NEXT_PUBLIC_ENCRYPTION_KEY from the frontend
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (process.env.NODE_ENV !== 'production') {
    console.log('Encryption key loaded:', {
        fromEnv: !!process.env.ENCRYPTION_KEY,
        keyLength: ENCRYPTION_KEY?.length || 0,
        keyPrefix: ENCRYPTION_KEY ? ENCRYPTION_KEY.substring(0, 10) + '...' : 'undefined'
    });
}

/**
 * Decrypts an encrypted string using AES decryption
 * @param encryptedText - The encrypted text to decrypt
 * @returns Decrypted string
 * @throws Error if decryption fails
 */
export const decrypt = (encryptedText: string): string => {
    try {
        if (!encryptedText) {
            throw new Error('Encrypted text is required');
        }

        if (!ENCRYPTION_KEY) {
            throw new Error('Encryption key is not configured. Please set ENCRYPTION_KEY environment variable.');
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('Decryption attempt - Key length:', ENCRYPTION_KEY.length);
            console.log('Encrypted text length:', encryptedText?.length || 0);
        }

        const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

        if (!decryptedText) {
            console.error('Decryption failed - empty result. Key used:', ENCRYPTION_KEY ? `${ENCRYPTION_KEY.substring(0, 10)}...` : 'undefined');
            throw new Error('Failed to decrypt data - invalid encryption key or corrupted data');
        }

        return decryptedText;
    } catch (error: any) {
        console.error('Decryption error details:', {
            message: error?.message,
            encryptedTextLength: encryptedText?.length,
            keyLength: ENCRYPTION_KEY?.length,
            keySet: !!ENCRYPTION_KEY
        });
        throw new Error('Failed to decrypt data');
    }
};

/**
 * Decrypts email and password from encrypted login credentials
 * @param encryptedCredentials - Encrypted credentials object
 * @returns Decrypted credentials object
 */
export const decryptCredentials = (encryptedCredentials: {
    email: string;
    password: string;
    isRemember?: boolean
}): { email: string; password: string; isRemember?: boolean } => {
    try {
        if (!encryptedCredentials.email || !encryptedCredentials.password) {
            throw new Error('Email and password are required for decryption');
        }

        const email = decrypt(encryptedCredentials.email);
        const password = decrypt(encryptedCredentials.password);

        if (!email || !password || email.trim() === '' || password.trim() === '') {
            throw new Error('Decrypted email or password is empty or invalid');
        }

        return {
            email: email.trim(),
            password: password.trim(),
            isRemember: encryptedCredentials.isRemember,
        };
    } catch (error: any) {
        console.error('Credentials decryption error:', {
            message: error?.message,
            hasEmail: !!encryptedCredentials.email,
            hasPassword: !!encryptedCredentials.password,
            emailLength: encryptedCredentials.email?.length,
            passwordLength: encryptedCredentials.password?.length
        });
        throw new Error('Failed to decrypt login credentials');
    }
};

