import {NextFunction, Request, Response} from 'express';
import {Readable} from 'stream';
import {CustomError} from './errorHandler';
import cloudinary, {isCloudinaryConfigured} from '../config/cloudinary';

const multer: any = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: any, cb: (error: Error | null, acceptFile?: boolean) => void) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

export const uploadToCloudinary = (
  file: any,
  folder: string
): Promise<{ url: string; publicId: string }> => {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(
      new Error(
        'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables in your .env file'
      )
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
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
    const baseFolder = `therapists/${therapistId}`;
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

export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> => {
  if (!isCloudinaryConfigured()) {
    console.warn(`Cannot delete file from Cloudinary: ${publicId} - Cloudinary is not configured`);
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error(`Failed to delete file from Cloudinary: ${publicId}`, error);
  }
};

