import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import Therapist, {ITherapist} from '../models/Therapist';
import {User} from '../models/User';
import Availability from '../models/Availability';
import {TherapistReview} from "../models/Review";
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';
import {deleteFromCloudinaryByUrl, uploadToCloudinary} from '../middleware/uploadMiddleware';
import {buildNameBasedFolder} from '../config/cloudinary';

type MulterFile = any;

const parseJsonField = (value: any, fieldName: string): any => {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            const error: CustomError = new Error(`Invalid ${fieldName} format`);
            error.statusCode = 400;
            throw error;
        }
    }
    return value;
};

const uploadSingleFile = async (file: MulterFile | MulterFile[], folder: string): Promise<string> => {
    const singleFile = Array.isArray(file) ? file[0] : file;
    if (!singleFile) throw new Error('File is required');
    const result = await uploadToCloudinary(singleFile, folder);
    return result.url;
};

const uploadMultipleFiles = async (files: MulterFile | MulterFile[], folder: string): Promise<string[]> => {
    const fileArray = Array.isArray(files) ? files : [files];
    if (fileArray.length === 0) return [];
    const results = await Promise.all(fileArray.map((file) => uploadToCloudinary(file, folder)));
    return results.map((r) => r.url);
};

const processPhone = (phoneData: any, existingPhone?: any): any => {
    if (phoneData === null || phoneData === undefined) return undefined;

    const parsed = parseJsonField(phoneData, 'phone');
    if (typeof parsed !== 'object' || parsed === null) {
        const error: CustomError = new Error('Phone must be an object with countryCode and number, or null to clear');
        error.statusCode = 400;
        throw error;
    }

    if (!parsed.countryCode || !parsed.number) {
        const error: CustomError = new Error('Phone must have both countryCode and number');
        error.statusCode = 400;
        throw error;
    }

    return {
        countryCode: String(parsed.countryCode).trim(),
        number: String(parsed.number).trim(),
        verified: parsed.verified === true || parsed.verified === 'true' || existingPhone?.verified || false
    };
};

// Create a new therapist
export const createTherapist = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            userId,
            profilePhoto,
            firstName,
            lastName,
            preferredName,
            email,
            phone,
            dateOfBirth,
            gender,
            city,
            country,
            timezone,
            bio,
            videoIntro,
            education,
            certifications,
            experience,
            specializations,
            languages,
            status,
            emailVerified,
        } = req.body;

        if (!userId || !firstName || !lastName || !email || !timezone) {
            const error: CustomError = new Error('User ID, first name, last name, email, and timezone are required');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findOne({_id: userId, deletedAt: null});
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const existingTherapist = await Therapist.findOne({user: userId, deletedAt: null});
        if (existingTherapist) {
            const error: CustomError = new Error('A therapist profile already exists for this user. Please update the existing profile instead.');
            error.statusCode = 409;
            throw error;
        }

        const emailExists = await Therapist.findOne({email: email.toLowerCase(), deletedAt: null});
        if (emailExists) {
            const error: CustomError = new Error('This email address is already in use by another therapist');
            error.statusCode = 409;
            throw error;
        }

        let specializationsArray = specializations || [];
        if (typeof specializations === 'string') {
            try {
                specializationsArray = JSON.parse(specializations);
            } catch (e) {
                specializationsArray = [];
            }
        }

        let languagesArray = languages || [];
        if (typeof languages === 'string') {
            try {
                languagesArray = JSON.parse(languages);
            } catch (e) {
                languagesArray = [];
            }
        }

        const validStatuses = ["approved", "pending", "rejected", "underReview"];
        const therapistStatus = status && validStatuses.includes(status) ? status : "pending";

        const therapist = new Therapist({
            user: userId,
            profilePhoto,
            firstName,
            lastName,
            preferredName,
            email: email.toLowerCase(),
            emailVerified: emailVerified !== undefined ? emailVerified : false,
            phone,
            status: therapistStatus,
            dateOfBirth,
            gender,
            city,
            country,
            timezone,
            bio,
            videoIntro,
            education: education || [],
            certifications: certifications || [],
            experience: experience || [],
            specializations: specializationsArray,
            languages: languagesArray,
        });

        await therapist.save();

        const therapistId = (therapist._id as mongoose.Types.ObjectId).toString();
        const folderName = buildNameBasedFolder(therapist.firstName, therapist.lastName, therapistId);
        const baseFolder = `therapists/${folderName}`;
        const updateData: any = {};
        const files = (req as any).files;

        if (files && 'profilePhoto' in files) {
            const file = Array.isArray(files.profilePhoto)
                ? files.profilePhoto[0]
                : files.profilePhoto;
            if (file) {
                const result = await uploadToCloudinary(file, `${baseFolder}/profile-photos`);
                updateData.profilePhoto = result.url;
            }
        }

        if (files && 'videoIntro' in files) {
            const file = Array.isArray(files.videoIntro)
                ? files.videoIntro[0]
                : files.videoIntro;
            if (file) {
                const result = await uploadToCloudinary(file, `${baseFolder}/video-intros`);
                updateData.videoIntro = result.url;
            }
        }

        if (files && 'educationPhotos' in files) {
            const educationFiles = Array.isArray(files.educationPhotos)
                ? files.educationPhotos
                : [files.educationPhotos];

            if (educationFiles.length > 0) {
                const uploadPromises = educationFiles.map((file: MulterFile) =>
                    uploadToCloudinary(file, `${baseFolder}/education`)
                );
                const results = await Promise.all(uploadPromises);
                const educationPhotos = results.map((r: { url: string; publicId: string }) => r.url);

                let educationArray = education;
                if (typeof education === 'string') {
                    try {
                        educationArray = JSON.parse(education);
                    } catch (e) {
                        educationArray = [];
                    }
                }

                if (Array.isArray(educationArray)) {
                    educationArray.forEach((edu: any, index: number) => {
                        if (educationPhotos[index]) {
                            edu.degreePhoto = educationPhotos[index];
                        }
                    });
                    updateData.education = educationArray;
                }
            }
        }

        if (files && 'certificationPhotos' in files) {
            const certificationFiles = Array.isArray(files.certificationPhotos)
                ? files.certificationPhotos
                : [files.certificationPhotos];

            if (certificationFiles.length > 0) {
                const uploadPromises = certificationFiles.map((file: MulterFile) =>
                    uploadToCloudinary(file, `${baseFolder}/certifications`)
                );
                const results = await Promise.all(uploadPromises);
                const certificationPhotos = results.map((r: { url: string; publicId: string }) => r.url);

                let certificationsArray = certifications;
                if (typeof certifications === 'string') {
                    try {
                        certificationsArray = JSON.parse(certifications);
                    } catch (e) {
                        certificationsArray = [];
                    }
                }

                if (Array.isArray(certificationsArray)) {
                    certificationsArray.forEach((cert: any, index: number) => {
                        if (certificationPhotos[index]) {
                            cert.certificatePhoto = certificationPhotos[index];
                        }
                    });
                    updateData.certifications = certificationsArray;
                }
            }
        }

        if (files && 'experiencePhotos' in files) {
            const experienceFiles = Array.isArray(files.experiencePhotos)
                ? files.experiencePhotos
                : [files.experiencePhotos];

            if (experienceFiles.length > 0) {
                const uploadPromises = experienceFiles.map((file: MulterFile) =>
                    uploadToCloudinary(file, `${baseFolder}/experience`)
                );
                const results = await Promise.all(uploadPromises);
                const experiencePhotos = results.map((r: { url: string; publicId: string }) => r.url);

                let experienceArray = experience;
                if (typeof experience === 'string') {
                    try {
                        experienceArray = JSON.parse(experience);
                    } catch (e) {
                        experienceArray = [];
                    }
                }

                if (Array.isArray(experienceArray)) {
                    experienceArray.forEach((exp: any, index: number) => {
                        if (experiencePhotos[index]) {
                            exp.experiencePhoto = experiencePhotos[index];
                        }
                    });
                    updateData.experience = experienceArray;
                }
            }
        }

        if (Object.keys(updateData).length > 0) {
            Object.assign(therapist, updateData);
            await therapist.save();
        }

        user.therapist = new mongoose.Types.ObjectId(therapist.id as string);
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Therapist profile created successfully',
            data: therapist,
        });
    } catch (error) {
        next(error);
    }
};

// Get all therapists
export const getAllTherapists = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            page = '1',
            limit = '10',
            search,
            specialization,
            language,
            status,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const query: any = {deletedAt: null};

        if (search) {
            query.$or = [
                {firstName: {$regex: search, $options: 'i'}},
                {lastName: {$regex: search, $options: 'i'}},
                {email: {$regex: search, $options: 'i'}},
                {bio: {$regex: search, $options: 'i'}},
            ];
        }

        if (specialization) {
            query.specializations = {$in: [specialization]};
        }

        if (language) {
            query.languages = {$in: [language]};
        }

        if (status) {
            const validStatuses = ["approved", "pending", "rejected", "underReview"];
            if (validStatuses.includes(status as string)) {
                query.status = status;
            }
        }

        const therapists = await Therapist.find(query)
            .populate('user', 'firstName lastName email role')
            .skip(skip)
            .limit(limitNum)
            .sort({createdAt: -1});

        const total = await Therapist.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Therapists retrieved successfully',
            data: {
                therapists,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get a single therapist by ID
export const getTherapistById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: id, deletedAt: null}).populate(
            'user',
            'firstName lastName email role'
        );

        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Therapist information retrieved successfully',
            data: therapist,
        });
    } catch (error) {
        next(error);
    }
};

// Get therapist by user ID
export const getTherapistByUserId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {userId} = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            const error: CustomError = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({user: userId, deletedAt: null}).populate(
            'user',
            'firstName lastName email role'
        );

        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Therapist information retrieved successfully',
            data: therapist,
        });
    } catch (error) {
        next(error);
    }
};

// Update therapist
export const updateTherapist = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const userId = req.user?._id;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        if (!userId) {
            const error: CustomError = new Error('User authentication required');
            error.statusCode = 401;
            throw error;
        }

        const [therapist, user] = await Promise.all([
            Therapist.findOne({_id: id, deletedAt: null}),
            User.findOne({_id: userId, deletedAt: null})
        ]);

        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const therapistUserId = therapist.user as mongoose.Types.ObjectId;
        const isOwner = therapistUserId.toString() === userId.toString();
        const isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
            const error: CustomError = new Error('Unauthorized. You can only update your own therapist profile');
            error.statusCode = 403;
            throw error;
        }

        const folderName = buildNameBasedFolder(therapist.firstName, therapist.lastName, id);
        const baseFolder = `therapists/${folderName}`;
        const updateData: Partial<ITherapist> = {};

        const rawFiles = (req as any).files as any;
        let files: any = rawFiles;

        if (Array.isArray(rawFiles)) {
            const normalizeFieldName = (name: string) => name.replace(/\[\d+\]$/, '');

            files = rawFiles.reduce((acc: any, file: any) => {
                const key = normalizeFieldName(file.fieldname);
                if (!acc[key]) acc[key] = [];
                acc[key].push(file);
                return acc;
            }, {} as Record<string, MulterFile[]>);
        }

        const uploadPromises: Promise<void>[] = [];

        if (files?.profilePhoto) {
            uploadPromises.push(
                (async () => {
                    if (therapist.profilePhoto) {
                        try {
                            await deleteFromCloudinaryByUrl(therapist.profilePhoto);
                        } catch (deleteError) {
                            console.warn('Failed to delete old profile photo:', deleteError);
                        }
                    }
                    const url = await uploadSingleFile(files.profilePhoto, `${baseFolder}/profile-photos`);
                    updateData.profilePhoto = url;
                })().catch((err) => {
                    const error: CustomError = new Error(`Failed to upload profile photo: ${err.message}`);
                    error.statusCode = 500;
                    throw error;
                })
            );
        }

        if (files?.videoIntro) {
            uploadPromises.push(
                (async () => {
                    if (therapist.videoIntro) {
                        try {
                            await deleteFromCloudinaryByUrl(therapist.videoIntro);
                        } catch (deleteError) {
                            console.warn('Failed to delete old video intro:', deleteError);
                        }
                    }
                    const url = await uploadSingleFile(files.videoIntro, `${baseFolder}/video-intros`);
                    updateData.videoIntro = url;
                })().catch((err) => {
                    const error: CustomError = new Error(`Failed to upload video intro: ${err.message}`);
                    error.statusCode = 500;
                    throw error;
                })
            );
        } else if (req.body.videoIntro) {
            updateData.videoIntro = req.body.videoIntro.trim();
        } else {
            updateData.videoIntro = therapist.videoIntro;
        }

        if (files?.educationPhotos) {
            uploadPromises.push(
                uploadMultipleFiles(files.educationPhotos, `${baseFolder}/education`)
                    .then(photos => {
                        const edu = req.body.education ? JSON.parse(req.body.education) : therapist.education;

                        edu.forEach((e: any, i: number) => {
                            if (photos[i]) e.degreePhoto = photos[i];
                        });

                        updateData.education = edu;
                    })
            );
        } else if (req.body.education) {
            updateData.education = JSON.parse(req.body.education);
        } else {
            updateData.education = therapist.education;
        }

        if (files?.certificationPhotos) {
            uploadPromises.push(
                uploadMultipleFiles(files.certificationPhotos, `${baseFolder}/certifications`)
                    .then(photos => {
                        const cert = req.body.certifications ? JSON.parse(req.body.certifications) : therapist.certifications;

                        cert.forEach((c: any, i: number) => {
                            if (photos[i]) c.certificatePhoto = photos[i];
                        });

                        updateData.certifications = cert;
                    })
            );
        } else if (req.body.certifications) {
            updateData.certifications = JSON.parse(req.body.certifications);
        } else {
            updateData.certifications = therapist.certifications;
        }

        if (files?.experiencePhotos) {
            uploadPromises.push(
                uploadMultipleFiles(files.experiencePhotos, `${baseFolder}/experience`)
                    .then(photos => {
                        const exp = req.body.experience ? JSON.parse(req.body.experience) : therapist.experience;

                        exp.forEach((e: any, i: number) => {
                            if (photos[i]) e.experiencePhoto = photos[i];
                        });

                        updateData.experience = exp;
                    })
            );
        } else if (req.body.experience) {
            updateData.experience = JSON.parse(req.body.experience);
        } else {
            updateData.experience = therapist.experience;
        }

        await Promise.all(uploadPromises);

        if (req.body.email !== undefined) {
            const newEmail = req.body.email.toLowerCase().trim();
            if (!newEmail) {
                const error: CustomError = new Error('Email cannot be empty');
                error.statusCode = 400;
                throw error;
            }
            if (newEmail !== therapist.email) {
                const emailExists = await Therapist.findOne({
                    email: newEmail,
                    _id: {$ne: id},
                    deletedAt: null
                });
                if (emailExists) {
                    const error: CustomError = new Error('This email address is already in use by another therapist');
                    error.statusCode = 409;
                    throw error;
                }
            }
        }

        const allowedFields = [
            'profilePhoto', 'firstName', 'lastName', 'preferredName', 'email',
            'phone', 'dateOfBirth', 'gender', 'city', 'country', 'timezone',
            'bio', 'videoIntro', 'education', 'certifications', 'experience',
            'specializations', 'languages'
        ];

        if (isAdmin && req.body.status !== undefined) {
            const validStatuses = ["approved", "pending", "rejected", "underReview"];
            if (validStatuses.includes(req.body.status)) {
                updateData.status = req.body.status;
            } else {
                const error: CustomError = new Error('Invalid status. Status must be one of: approved, pending, rejected, or underReview');
                error.statusCode = 400;
                throw error;
            }
        }

        if (isAdmin && req.body.emailVerified !== undefined) {
            updateData.emailVerified = req.body.emailVerified === true || req.body.emailVerified === 'true';
        }

        if (isAdmin && req.body.reviewNotes !== undefined) {
            updateData.reviewNotes = req.body.reviewNotes;
        }

        for (const field of allowedFields) {
            if (req.body[field] !== undefined && !updateData[field as keyof ITherapist]) {
                if (field === 'email') {
                    updateData[field] = req.body[field].toLowerCase().trim();
                } else if (field === 'phone') {
                    updateData.phone = processPhone(req.body.phone, therapist.phone);
                } else if (field === 'specializations' || field === 'languages') {
                    const parsed = parseJsonField(req.body[field], field);
                    if (!Array.isArray(parsed)) {
                        const error: CustomError = new Error(`${field} must be an array`);
                        error.statusCode = 400;
                        throw error;
                    }
                    (updateData as any)[field] = parsed;
                } else if (field === 'education' || field === 'certifications' || field === 'experience') {
                    if (!updateData[field as keyof ITherapist]) {
                        const parsed = parseJsonField(req.body[field], field);
                        if (!Array.isArray(parsed)) {
                            const error: CustomError = new Error(`${field} must be an array`);
                            error.statusCode = 400;
                            throw error;
                        }
                        (updateData as any)[field] = parsed;
                    }
                } else if (field === 'dateOfBirth') {
                    if (req.body[field]) {
                        const date = new Date(req.body[field]);
                        if (isNaN(date.getTime())) {
                            const error: CustomError = new Error('Invalid dateOfBirth format');
                            error.statusCode = 400;
                            throw error;
                        }
                        updateData[field] = date;
                    }
                } else {
                    (updateData as any)[field] = req.body[field];
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            const error: CustomError = new Error('No valid fields to update');
            error.statusCode = 400;
            throw error;
        }

        const commonFields = ['firstName', 'lastName', 'email', 'dateOfBirth', 'gender', 'country', 'timezone'];
        const userUpdateData: any = {};
        let shouldUpdateUser = false;

        for (const field of commonFields) {
            const fieldKey = field as keyof ITherapist;
            const fieldValue = updateData[fieldKey];
            if (fieldValue !== undefined) {
                userUpdateData[field] = field === 'email'
                    ? String(fieldValue).toLowerCase().trim()
                    : fieldValue;
                shouldUpdateUser = true;
            }
        }

        if (updateData.phone !== undefined) {
            userUpdateData.phone = updateData.phone && typeof updateData.phone === 'object' && 'countryCode' in updateData.phone
                ? {...updateData.phone, verified: updateData.phone.verified ?? false}
                : undefined;
            shouldUpdateUser = true;
        }

        if (shouldUpdateUser && userUpdateData.email) {
            const therapistUser = await User.findOne({_id: therapistUserId, deletedAt: null});
            if (!therapistUser) {
                const error: CustomError = new Error('Associated user not found');
                error.statusCode = 404;
                throw error;
            }

            if (userUpdateData.email !== therapistUser.email) {
                const emailExists = await User.findOne({
                    email: userUpdateData.email,
                    _id: {$ne: therapistUserId},
                    deletedAt: null
                });
                if (emailExists) {
                    const error: CustomError = new Error('This email address is already in use by another user account');
                    error.statusCode = 409;
                    throw error;
                }
            }
        }

        const updatePromises: Promise<any>[] = [
            Therapist.findByIdAndUpdate(id, {$set: updateData}, {new: true, runValidators: true})
                .populate('user', 'firstName lastName email role')
        ];

        if (shouldUpdateUser) {
            updatePromises.push(
                User.findByIdAndUpdate(therapistUserId, {$set: userUpdateData}, {new: true, runValidators: true})
            );
        }

        const [updatedTherapist] = await Promise.all(updatePromises);

        if (!updatedTherapist) {
            const error: CustomError = new Error('Failed to update therapist profile. Please try again.');
            error.statusCode = 500;
            throw error;
        }

        const finalTherapist = shouldUpdateUser
            ? await Therapist.findById(id).populate('user', 'firstName lastName email role')
            : updatedTherapist;

        res.status(200).json({
            success: true,
            message: 'Therapist profile updated successfully',
            data: finalTherapist,
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const validationError: CustomError = new Error(`Validation error: ${error.message}`);
            validationError.statusCode = 400;
            return next(validationError);
        }
        next(error);
    }
};

// Update therapist status (Admin only)
export const updateTherapistStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {status, reviewNotes} = req.body;
        const userId = req.user?._id;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        if (!userId) {
            const error: CustomError = new Error('User authentication required');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findOne({_id: userId, deletedAt: null});
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        if (user.role !== 'admin' && user.role !== 'superAdmin') {
            const error: CustomError = new Error('Unauthorized. Only admins can update therapist status');
            error.statusCode = 403;
            throw error;
        }

        if (!status) {
            const error: CustomError = new Error('Status is required');
            error.statusCode = 400;
            throw error;
        }

        const validStatuses = ["approved", "pending", "rejected", "underReview"];
        if (!validStatuses.includes(status)) {
            const error: CustomError = new Error('Invalid status. Status must be one of: approved, pending, rejected, or underReview');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: id, deletedAt: null});
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData: Partial<ITherapist> = {
            status: status,
        };

        if (reviewNotes !== undefined) {
            updateData.reviewNotes = reviewNotes;
        }

        const updatedTherapist = await Therapist.findByIdAndUpdate(
            id,
            {$set: updateData},
            {new: true, runValidators: true}
        ).populate('user', 'firstName lastName email role');

        if (!updatedTherapist) {
            const error: CustomError = new Error('Failed to update therapist status. Please try again.');
            error.statusCode = 500;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Therapist status updated successfully',
            data: updatedTherapist,
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const validationError: CustomError = new Error(`Validation error: ${error.message}`);
            validationError.statusCode = 400;
            return next(validationError);
        }
        next(error);
    }
};

// Delete therapist
export const deleteTherapist = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const userId = req.user?._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: id, deletedAt: null});
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const user = await User.findOne({_id: userId, deletedAt: null});
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const therapistUserId = (therapist.user as mongoose.Types.ObjectId).toString();
        if (therapistUserId !== userId && user.role !== 'admin') {
            const error: CustomError = new Error('Unauthorized. You can only delete your own therapist profile');
            error.statusCode = 403;
            throw error;
        }

        await Therapist.findByIdAndUpdate(id, {deletedAt: new Date()});

        await User.findByIdAndUpdate(therapist.user, {deletedAt: new Date()});

        res.status(200).json({
            success: true,
            message: 'Therapist profile deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Get approved therapists with availability (for patient listing)
export const getApprovedTherapists = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    try {
        const {
            page = "1",
            limit = "10",
            search,
            specialization,
            language,
            minPrice,
            maxPrice,
            serviceEnabled,
        } = req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        const toArray = (val: any): string[] => {
            if (!val) return [];
            if (Array.isArray(val)) return val.map(String);
            return String(val)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        };

        const therapistQuery: any = {
            deletedAt: null,
            status: "approved",
            "certifications.0": {$exists: true},
            "education.0": {$exists: true},
            "experience.0": {$exists: true},

            certifications: {$not: {$elemMatch: {status: {$ne: "valid"}}}},
            education: {$not: {$elemMatch: {status: {$ne: "valid"}}}},
            experience: {$not: {$elemMatch: {status: {$ne: "valid"}}}},
        };

        if (search) {
            const s = String(search);
            therapistQuery.$or = [
                {firstName: {$regex: s, $options: "i"}},
                {lastName: {$regex: s, $options: "i"}},
                {email: {$regex: s, $options: "i"}},
                {bio: {$regex: s, $options: "i"}},
            ];
        }

        const specArr = toArray(specialization);
        if (specArr.length) therapistQuery.specializations = {$in: specArr};

        const langArr = toArray(language);
        if (langArr.length) therapistQuery.languages = {$in: langArr};

        if (serviceEnabled !== undefined) {
            therapistQuery.serviceEnabled = serviceEnabled === "true";
        }

        const availabilityQuery: any = {
            serviceEnabled: true,
            "availabilityCalendar.isAvailable": true,
        };

        if (minPrice) {
            availabilityQuery.price = {...(availabilityQuery.price || {}), $gte: Number(minPrice)};
        }
        if (maxPrice) {
            availabilityQuery.price = {...(availabilityQuery.price || {}), $lte: Number(maxPrice)};
        }

        const availabilityDocs = await Availability.find(availabilityQuery).lean();

        const availableIds = availabilityDocs
            .map((a: any) => a?.therapistId ? String(a.therapistId) : null)
            .filter((id: string | null): id is string => id !== null);

        if (!availableIds.length) {
            return res.status(200).json({
                success: true,
                message: "Therapists retrieved successfully",
                data: {
                    therapists: [],
                    pagination: {page: pageNum, limit: limitNum, total: 0, pages: 0},
                },
            });
        }

        therapistQuery._id = {
            $in: availableIds.map((id: string) => new mongoose.Types.ObjectId(id)),
        };

        const total = await Therapist.countDocuments(therapistQuery);

        const therapists = await Therapist.find(therapistQuery)
            .populate("user", "firstName lastName email role")
            .skip(skip)
            .limit(limitNum)
            .sort({createdAt: -1})
            .lean();

        const finalList = await Promise.all(
            therapists.map(async (t: any) => {
                const av = availabilityDocs.find(
                    (a: any) => String(a.therapistId) === String(t._id)
                );

                const reviews = await TherapistReview.find({
                    therapist: t._id,
                    status: "approved",
                    deletedAt: null,
                })
                    .select("rating review isAnonymous reviewer createdAt")
                    .populate("reviewer", "firstName lastName profilePhoto")
                    .lean();

                const totalReviews = reviews.length;
                const averageRating =
                    totalReviews > 0
                        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
                        : 0;

                return {
                    ...t,
                    availability: av || null,
                    reviews,
                    totalReviews,
                    averageRating: Number(averageRating.toFixed(1)),
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Therapists retrieved successfully",
            data: {
                therapists: finalList,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        next(error);
    }
}