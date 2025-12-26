import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import {User} from '../models/User';
import Therapist from '../models/Therapist';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';
import {deleteFromCloudinaryByUrl, uploadToCloudinary} from '../middleware/uploadMiddleware';
import {buildNameBasedFolder} from '../config/cloudinary';
import bcrypt from 'bcrypt';
import {decrypt} from '../utils/decryption';

// Create a new user
export const createUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth,
            gender,
            country,
            timezone,
            password,
            role,
            privacyPolicyAccepted,
            termsOfServiceAccepted,
            status,
        } = req.body;

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone?.countryCode ||
            !phone?.number ||
            !dateOfBirth ||
            !gender ||
            !country ||
            !timezone ||
            !password
        ) {
            const error: CustomError = new Error('All required fields must be provided');
            error.statusCode = 400;
            throw error;
        }

        // Check if user already exists
        const existingUser = await User.findOne({email: email.toLowerCase()});
        if (existingUser) {
            const error: CustomError = new Error('User with this email already exists');
            error.statusCode = 409;
            throw error;
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Handle profile photo upload
        let profilePhotoUrl = null;
        const files = (req as any).files;
        if (files && files.profilePhoto && files.profilePhoto[0]) {
            const profilePhotoFile = files.profilePhoto[0];
            const folderPath = buildNameBasedFolder(firstName, lastName, email);
            const uploadResult = await uploadToCloudinary(profilePhotoFile, folderPath);
            profilePhotoUrl = uploadResult.url;
        }

        // Create user
        const user = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone: {
                countryCode: phone.countryCode,
                number: phone.number,
                verified: false,
            },
            dateOfBirth,
            gender,
            country,
            timezone,
            password: hashedPassword,
            role: role || 'patient',
            privacyPolicyAccepted: privacyPolicyAccepted || false,
            termsOfServiceAccepted: termsOfServiceAccepted || false,
            status: status || 'active',
            profilePhoto: profilePhotoUrl,
            isOnline: false,
            lastSeen: null,
        });

        await user.save();

        // If role is therapist, create therapist profile
        if (role === 'therapist') {
            const therapist = new Therapist({
                user: user._id,
                status: 'pending',
            });
            await therapist.save();
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                userId: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get all users (admin only)
export const getAllUsers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {page = 1, limit = 20, role, status, search} = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const query: any = {deletedAt: null};

        if (role) {
            query.role = role;
        }

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                {firstName: {$regex: search as string, $options: 'i'}},
                {lastName: {$regex: search as string, $options: 'i'}},
                {email: {$regex: search as string, $options: 'i'}},
            ];
        }

        const users = await User.find(query)
            .select('-password -refreshToken')
            .sort({createdAt: -1})
            .skip(skip)
            .limit(limitNum);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get user by ID
export const getUserById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findById(id).select('-password -refreshToken');

        if (!user || user.deletedAt) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// Get current user
export const getCurrentUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!._id;

        const user = await User.findById(userId).select('-password -refreshToken');

        if (!user || user.deletedAt) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Current user retrieved successfully',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// Accept terms and privacy policy
export const acceptTermsAndPrivacy = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const {privacyPolicyAccepted, termsOfServiceAccepted} = req.body;

        const user = await User.findById(userId);

        if (!user || user.deletedAt) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        if (privacyPolicyAccepted !== undefined) {
            user.privacyPolicyAccepted = privacyPolicyAccepted;
        }

        if (termsOfServiceAccepted !== undefined) {
            user.termsOfServiceAccepted = termsOfServiceAccepted;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Terms and privacy policy acceptance updated successfully',
            data: {
                privacyPolicyAccepted: user.privacyPolicyAccepted,
                termsOfServiceAccepted: user.termsOfServiceAccepted,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update user
export const updateUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;
        const currentUserRole = req.user!.role;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        // Users can only update themselves unless they're admin
        if (id !== currentUserId.toString() && currentUserRole !== 'admin' && currentUserRole !== 'superAdmin') {
            const error: CustomError = new Error('You do not have permission to update this user');
            error.statusCode = 403;
            throw error;
        }

        const user = await User.findById(id);

        if (!user || user.deletedAt) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const {
            firstName,
            lastName,
            phone,
            dateOfBirth,
            gender,
            country,
            timezone,
            status,
        } = req.body;

        // Handle profile photo upload
        const files = (req as any).files;
        if (files && files.profilePhoto && files.profilePhoto[0]) {
            const profilePhotoFile = files.profilePhoto[0];

            // Delete old profile photo if exists
            if (user.profilePhoto) {
                try {
                    await deleteFromCloudinaryByUrl(user.profilePhoto);
                } catch (deleteError) {
                    console.error('Error deleting old profile photo:', deleteError);
                }
            }

            const folderPath = buildNameBasedFolder(
                user.firstName,
                user.lastName,
                user.email
            );
            const uploadResult = await uploadToCloudinary(profilePhotoFile, folderPath);
            user.profilePhoto = uploadResult.url;
        }

        // Update fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) {
            if (phone.countryCode) user.phone.countryCode = phone.countryCode;
            if (phone.number) user.phone.number = phone.number;
            if (phone.verified !== undefined) user.phone.verified = phone.verified;
        }
        if (dateOfBirth) user.dateOfBirth = dateOfBirth;
        if (gender) user.gender = gender;
        if (country) user.country = country;
        if (timezone) user.timezone = timezone;

        // Only admins can update status
        if (status && (currentUserRole === 'admin' || currentUserRole === 'superAdmin')) {
            user.status = status;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profilePhoto: user.profilePhoto,
                phone: user.phone,
                dateOfBirth: user.dateOfBirth,
                gender: user.gender,
                country: user.country,
                timezone: user.timezone,
                status: user.status,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete user (admin only)
export const deleteUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        // Prevent self-deletion
        if (id === currentUserId.toString()) {
            const error: CustomError = new Error('You cannot delete your own account');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findById(id);

        if (!user || user.deletedAt) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Soft delete
        user.deletedAt = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            data: {
                userId: user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};


// Set password for a user (admin only, only if password is null)
export const setUserPassword = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {password: passwordInput} = req.body;

        if (!passwordInput) {
            const error: CustomError = new Error('Password is required');
            error.statusCode = 400;
            throw error;
        }

        let password: string;
        try {
            password = decrypt(passwordInput);
        } catch (decryptError) {
            // If decryption fails, assume it's plain text
            password = passwordInput;
        }

        if (!password || password.trim() === '') {
            const error: CustomError = new Error('Password cannot be empty');
            error.statusCode = 400;
            throw error;
        }

        if (password.length < 6) {
            const error: CustomError = new Error('Password must be at least 6 characters long');
            error.statusCode = 400;
            throw error;
        }

        // Find the user
        const user = await User.findOne({_id: id, deletedAt: null});

        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if password already exists
        if (user.password && typeof user.password === 'string' && user.password.length > 0) {
            const error: CustomError = new Error('User already has a password set. Cannot set password for users with existing password.');
            error.statusCode = 400;
            throw error;
        }

        // Hash and set the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password.trim(), saltRounds);

        user.password = hashedPassword;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password set successfully for user',
            data: {
                userId: user._id,
                email: user.email,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update user online status
export const updateOnlineStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const currentUserId = req.user!._id;
        const {isOnline} = req.body;

        if (typeof isOnline !== 'boolean') {
            const error: CustomError = new Error('isOnline must be a boolean');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findById(currentUserId);
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        user.isOnline = isOnline;
        if (!isOnline) {
            user.lastSeen = new Date();
        }
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Online status updated successfully',
            data: {
                isOnline: user.isOnline,
                lastSeen: user.lastSeen,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get user online status and last seen
export const getUserStatus = async (
    req: AuthRequest,
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

        const user = await User.findById(userId).select('isOnline lastSeen firstName lastName');
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'User status retrieved successfully',
            data: {
                userId: user._id,
                isOnline: user.isOnline || false,
                lastSeen: user.lastSeen || null,
                firstName: user.firstName,
                lastName: user.lastName,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete current authenticated user's account (soft delete with password confirmation & reason)
export const deleteCurrentUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?._id;
        const {reason, password} = req.body;

        if (!userId) throw {statusCode: 401, message: "User not authenticated"};
        if (!password) throw {statusCode: 400, message: "Password is required"};

        const user = await User.findOne({_id: userId, deletedAt: null});
        if (!user) throw {statusCode: 404, message: "User not found"};

        if (!user.password) throw {statusCode: 400, message: "Account has no password set"};

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw {statusCode: 401, message: "Invalid password"};

        if (user.role === "therapist") {
            const result = await Therapist.findByIdAndUpdate(
                user.therapist,
                {deletedAt: new Date()}
            );

            if (!result) console.warn("Therapist not found or already deleted");
        }

        await User.findByIdAndUpdate(userId, {
            deletedAt: new Date(),
            accountDeletionReason: reason || null,
            $inc: {tokenVersion: 1}
        });

        res.status(200).json({success: true, message: "Your account has been deleted successfully"});

    } catch (error: any) {
        next({statusCode: error.statusCode || 500, message: error.message});
    }
};

