import {NextFunction, Request, Response} from 'express';
import {Readable} from 'stream';
import {CustomError} from './errorHandler';
import cloudinary, {
    buildFolderPath,
    buildNameBasedFolder,
    isCloudinaryConfigured,
    validateFolderName
} from '../config/cloudinary';
import Therapist from '../models/Therapist';

const multer: any = require('multer');

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, _file: any, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
});

/**
 * Validates file size - 50 MB limit for all file types
 * @param file - The file object with buffer and mimetype
 * @throws Error if file size exceeds 50 MB
 */
const validateFileSize = (file: any): void => {
    if (!file || !file.buffer) {
        throw new Error('Invalid file: missing buffer');
    }

    const fileSize = file.buffer.length;
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    if (fileSize > MAX_FILE_SIZE) {
        throw new Error(
            `File size (${fileSizeMB} MB) exceeds the maximum allowed size of ${maxSizeMB} MB. ` +
            `Please upload a smaller file.`
        );
    }
};

export const uploadToCloudinary = (
    file: any,
    folder: string,
    options?: {
        transformation?: any;
        overwrite?: boolean;
        invalidate?: boolean;
    }
): Promise<{ url: string; publicId: string }> => {
    if (!isCloudinaryConfigured()) {
        return Promise.reject(
            new Error(
                'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables in your .env file'
            )
        );
    }

    try {
        validateFolderName(folder);
    } catch (error) {
        return Promise.reject(error);
    }

    try {
        validateFileSize(file);
    } catch (error) {
        return Promise.reject(error);
    }

    const completeFolder = buildFolderPath(folder);

    let resourceType: 'image' | 'video' | 'raw' = 'raw';
    if (file.mimetype.startsWith('video/')) {
        resourceType = 'video';
    } else if (file.mimetype.startsWith('image/')) {
        resourceType = 'image';
    }

    const defaultTransformations = resourceType === 'image'
        ? {
            quality: 'auto:good',
            fetch_format: 'auto',
        }
        : resourceType === 'video'
            ? {
                quality: 'auto:good',
            }
            : {};

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: completeFolder,
                resource_type: resourceType,
                transformation: options?.transformation || defaultTransformations,
                overwrite: options?.overwrite ?? false,
                invalidate: options?.invalidate ?? true,
                use_filename: false,
                unique_filename: true,
            },
            (error: any, result: any) => {
                if (error) {
                    reject(error);
                } else if (result) {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                    });
                } else {
                    reject(new Error('Upload failed: No result from Cloudinary'));
                }
            }
        );

        const stream = new Readable();
        stream.push(file.buffer);
        stream.push(null);
        stream.pipe(uploadStream);
    });
};

export const handleTherapistUploads = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const therapistId = req.params.id || 'temp';
        let baseFolder: string;

        if (therapistId !== 'temp' && therapistId.match(/^[0-9a-fA-F]{24}$/)) {
            try {
                const therapist = await Therapist.findById(therapistId);
                if (therapist) {
                    const folderName = buildNameBasedFolder(therapist.firstName, therapist.lastName, therapistId);
                    baseFolder = `therapists/${folderName}`;
                } else {
                    baseFolder = `therapists/${therapistId}`;
                }
            } catch (error) {
                baseFolder = `therapists/${therapistId}`;
            }
        } else {
            baseFolder = `therapists/temp-${therapistId}`;
        }

        const files = (req as any).files;

        if (files && 'profilePhoto' in files) {
            const file = Array.isArray(files.profilePhoto)
                ? files.profilePhoto[0]
                : files.profilePhoto;
            if (file) {
                const result = await uploadToCloudinary(file, `${baseFolder}/profile-photos`);
                req.body.profilePhoto = result.url;
            }
        }

        if (files && 'videoIntro' in files) {
            const file = Array.isArray(files.videoIntro)
                ? files.videoIntro[0]
                : files.videoIntro;
            if (file) {
                const result = await uploadToCloudinary(file, `${baseFolder}/video-intros`);
                req.body.videoIntro = result.url;
            }
        }

        if (files && 'educationPhotos' in files) {
            const educationFiles = Array.isArray(files.educationPhotos)
                ? files.educationPhotos
                : [files.educationPhotos];

            if (educationFiles.length > 0) {
                const uploadPromises = educationFiles.map((file: any) =>
                    uploadToCloudinary(file, `${baseFolder}/education`)
                );
                const results = await Promise.all(uploadPromises);
                const educationPhotos = results.map((r: { url: string; publicId: string }) => r.url);

                if (req.body.education) {
                    const education = typeof req.body.education === 'string'
                        ? JSON.parse(req.body.education)
                        : req.body.education;

                    education.forEach((edu: any, index: number) => {
                        if (educationPhotos[index]) {
                            edu.degreePhoto = educationPhotos[index];
                        }
                    });
                    req.body.education = education;
                }
            }
        }

        if (files && 'certificationPhotos' in files) {
            const certificationFiles = Array.isArray(files.certificationPhotos)
                ? files.certificationPhotos
                : [files.certificationPhotos];

            if (certificationFiles.length > 0) {
                const uploadPromises = certificationFiles.map((file: any) =>
                    uploadToCloudinary(file, `${baseFolder}/certifications`)
                );
                const results = await Promise.all(uploadPromises);
                const certificationPhotos = results.map((r: { url: string; publicId: string }) => r.url);

                if (req.body.certifications) {
                    const certifications = typeof req.body.certifications === 'string'
                        ? JSON.parse(req.body.certifications)
                        : req.body.certifications;

                    certifications.forEach((cert: any, index: number) => {
                        if (certificationPhotos[index]) {
                            cert.certificatePhoto = certificationPhotos[index];
                        }
                    });
                    req.body.certifications = certifications;
                }
            }
        }

        if (files && 'experiencePhotos' in files) {
            const experienceFiles = Array.isArray(files.experiencePhotos)
                ? files.experiencePhotos
                : [files.experiencePhotos];

            if (experienceFiles.length > 0) {
                const uploadPromises = experienceFiles.map((file: any) =>
                    uploadToCloudinary(file, `${baseFolder}/experience`)
                );
                const results = await Promise.all(uploadPromises);
                const experiencePhotos = results.map((r: { url: string; publicId: string }) => r.url);

                if (req.body.experience) {
                    const experience = typeof req.body.experience === 'string'
                        ? JSON.parse(req.body.experience)
                        : req.body.experience;

                    experience.forEach((exp: any, index: number) => {
                        if (experiencePhotos[index]) {
                            exp.experiencePhoto = experiencePhotos[index];
                        }
                    });
                    req.body.experience = experience;
                }
            }
        }

        next();
    } catch (error) {
        const customError: CustomError = new Error(
            `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        customError.statusCode = 500;
        next(customError);
    }
};

/**
 * Deletes a file from Cloudinary by public ID
 * @param publicId - The public ID of the file to delete
 * @param resourceType - The resource type ('image' or 'video')
 * @returns Promise that resolves when deletion is complete
 */
export const deleteFromCloudinary = async (
    publicId: string,
    resourceType: 'image' | 'video' = 'image'
): Promise<{ result: string }> => {
    if (!isCloudinaryConfigured()) {
        const error = new Error('Cloudinary is not configured');
        console.warn(`Cannot delete file from Cloudinary: ${publicId} - ${error.message}`);
        throw error;
    }

    if (!publicId || typeof publicId !== 'string') {
        throw new Error('Invalid public ID provided');
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true,
        });

        if (result.result === 'not found') {
            console.warn(`File not found in Cloudinary: ${publicId}`);
        }

        return result;
    } catch (error) {
        console.error(`Failed to delete file from Cloudinary: ${publicId}`, error);
        throw error;
    }
};

/**
 * Extracts public ID from a Cloudinary URL
 * @param url - The Cloudinary URL
 * @returns The public ID or null if extraction fails
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
    if (!url || typeof url !== 'string') {
        return null;
    }

    try {
        const urlPattern = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
        const match = url.match(urlPattern);

        if (match && match[1]) {
            const publicId = match[1].split('/').pop();
            return decodeURIComponent(publicId?.replace(/\.[^.]+$/, '') || '');
        }

        return null;
    } catch (error) {
        console.error('Error extracting public ID from URL:', error);
        return null;
    }
};

/**
 * Deletes a file from Cloudinary by URL
 * @param url - The Cloudinary URL of the file to delete
 * @param resourceType - The resource type ('image' or 'video'). If not provided, will try to detect from URL
 * @returns Promise that resolves when deletion is complete
 */
export const deleteFromCloudinaryByUrl = async (
    url: string,
    resourceType?: 'image' | 'video'
): Promise<{ result: string }> => {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
        throw new Error('Could not extract public ID from URL');
    }

    if (!resourceType) {
        resourceType = url.includes('/video/') ? 'video' : 'image';
    }

    return deleteFromCloudinary(publicId, resourceType);
};

/**
 * Deletes all files in a folder from Cloudinary
 * @param folderPath - The folder path (without base prefix)
 * @param resourceType - The resource type ('image' or 'video')
 * @returns Promise that resolves when deletion is complete
 */
export const deleteFolderFromCloudinary = async (
    folderPath: string,
    resourceType: 'image' | 'video' = 'image'
): Promise<void> => {
    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured');
    }

    try {
        validateFolderName(folderPath);
    } catch (error) {
        throw error;
    }

    const completeFolder = buildFolderPath(folderPath);

    try {
        const result = await cloudinary.api.delete_resources_by_prefix(
            completeFolder,
            {
                resource_type: resourceType,
                invalidate: true,
            }
        );

        console.log(`Deleted folder from Cloudinary: ${completeFolder}`, result);
    } catch (error) {
        console.error(`Failed to delete folder from Cloudinary: ${completeFolder}`, error);
        throw error;
    }
};

