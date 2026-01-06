import dotenv from 'dotenv';

dotenv.config();

const cloudinary: any = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.CLOUD_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUD_API_SECRET;

export const CLOUDINARY_BASE_FOLDER = process.env.CLOUDINARY_BASE_FOLDER || 'mental-health-app';

if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
        '⚠️  Cloudinary credentials are not fully configured. File uploads will not work. ' +
        'Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in your .env file'
    );
} else {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
    console.log('✅ Cloudinary configured successfully');
    console.log(`📁 Base folder: ${CLOUDINARY_BASE_FOLDER}`);
}

export const isCloudinaryConfigured = (): boolean => {
    return !!(cloudName && apiKey && apiSecret);
};

/**
 * Builds a complete folder path with base folder prefix
 * @param folderPath - The folder path (e.g., 'users/123/profile-photos')
 * @returns Complete folder path with base prefix (e.g., 'mental-health-app/users/123/profile-photos')
 */
export const buildFolderPath = (folderPath: string): string => {
    const normalized = folderPath.replace(/^\/+|\/+$/g, '');
    if (normalized.startsWith(CLOUDINARY_BASE_FOLDER + '/')) {
        return normalized;
    }
    return `${CLOUDINARY_BASE_FOLDER}/${normalized}`;
};

/**
 * Validates folder name to prevent invalid characters
 * @param folderName - The folder name to validate
 * @returns true if valid, throws error if invalid
 */
export const validateFolderName = (folderName: string): boolean => {
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(folderName)) {
        throw new Error(`Invalid folder name: ${folderName}. Contains invalid characters.`);
    }
    return true;
};

/**
 * Sanitizes a name for use in folder paths
 * Removes special characters, trims whitespace, and converts to lowercase
 * @param name - The name to sanitize
 * @returns Sanitized name safe for folder paths
 */
export const sanitizeFolderName = (name: string): string => {
    if (!name || typeof name !== 'string') {
        return '';
    }

    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

/**
 * Builds a folder name with format: {firstName-lastName-id}
 * @param firstName - First name
 * @param lastName - Last name
 * @param id - User or therapist ID
 * @returns Formatted folder name
 */
export const buildNameBasedFolder = (firstName: string, lastName: string, id: string): string => {
    const sanitizedFirstName = sanitizeFolderName(firstName);
    const sanitizedLastName = sanitizeFolderName(lastName);
    const sanitizedId = id.toString().trim();

    if (!sanitizedFirstName && !sanitizedLastName) {
        return sanitizedId;
    }

    const parts = [sanitizedFirstName, sanitizedLastName, sanitizedId].filter(Boolean);
    return parts.join('-');
};

export default cloudinary;