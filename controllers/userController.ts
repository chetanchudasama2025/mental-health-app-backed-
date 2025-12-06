import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import Therapist from '../models/Therapist';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadToCloudinary } from '../middleware/uploadMiddleware';
import bcrypt from 'bcrypt';

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

    const validRoles = ['admin', 'therapist', 'patient', 'superAdmin', 'therapistManager', 'supportAgent', 'contentModerator'];
    if (role && !validRoles.includes(role)) {
      const error: CustomError = new Error('Invalid role. Role must be one of: admin, therapist, patient, superAdmin, therapistManager, supportAgent, or contentModerator');
      error.statusCode = 400;
      throw error;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (existingUser) {
      const error: CustomError = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const validStatuses = ['active', 'inactive', 'pending', 'blocked', 'suspended'];
    const userStatus = status && validStatuses.includes(status) ? status : 'active';

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      dateOfBirth,
      gender,
      country,
      timezone,
      password: hashedPassword,
      role: role || 'patient',
      privacyPolicyAccepted: privacyPolicyAccepted || false,
      termsOfServiceAccepted: termsOfServiceAccepted || false,
      status: userStatus,
    });

    user.tokenVersion = 0;
    await user.save();

    const files = (req as any).files;
    if (files && 'profilePhoto' in files) {
      const file = Array.isArray(files.profilePhoto)
        ? files.profilePhoto[0]
        : files.profilePhoto;
      if (file) {
        const userId = (user._id as mongoose.Types.ObjectId).toString();
        const baseFolder = `users/${userId}`;
        try {
          const result = await uploadToCloudinary(file, `${baseFolder}/profile-photos`);
          user.profilePhoto = result.url;
          await user.save();
        } catch (uploadError) {
          console.error('Profile photo upload error:', uploadError);
        }
      }
    }

    const updatedUser = await User.findById(user._id).select('-password');
    const { password: _, ...userResponse } = updatedUser!.toObject();

    res.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      role,
      country,
      gender,
      status,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = { deletedAt: null };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }

    if (gender) {
      query.gender = gender;
    }

    if (status) {
      const validStatuses = ['active', 'inactive', 'pending', 'blocked', 'suspended'];
      if (validStatuses.includes(status as string)) {
        query.status = status;
      }
    }

    const users = await User.find(query)
      .select('-password')
      .populate('therapist', 'firstName lastName email')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
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

// Get a single user by ID
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: id, deletedAt: null })
      .select('-password')
      .populate('therapist', 'firstName lastName email');

    if (!user) {
      const error: CustomError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'User information retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Get current user (authenticated user's own profile)
export const getCurrentUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User authentication required');
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error: CustomError = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: userId, deletedAt: null })
      .select('-password')
      .populate('therapist', 'firstName lastName email');

    if (!user) {
      const error: CustomError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'User information retrieved successfully',
      data: user,
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
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: id, deletedAt: null });
    if (!user) {
      const error: CustomError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const currentUser = await User.findOne({ _id: userId, deletedAt: null });
    if (!currentUser) {
      const error: CustomError = new Error('Current user not found');
      error.statusCode = 404;
      throw error;
    }

    if (id !== userId && currentUser.role !== 'admin') {
      const error: CustomError = new Error('Unauthorized. You can only update your own profile');
      error.statusCode = 403;
      throw error;
    }

    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({
        email: req.body.email.toLowerCase(),
        _id: { $ne: id },
        deletedAt: null,
      });
      if (emailExists) {
        const error: CustomError = new Error('This email address is already in use by another account');
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData: Partial<IUser> = {};
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'dateOfBirth',
      'gender',
      'country',
      'timezone',
      'privacyPolicyAccepted',
      'termsOfServiceAccepted',
      'profilePhoto',
    ];

    if (currentUser.role === 'admin' && req.body.role !== undefined) {
      const validRoles = ['admin', 'therapist', 'patient', 'superAdmin', 'therapistManager', 'supportAgent', 'contentModerator'];
      if (!validRoles.includes(req.body.role)) {
        const error: CustomError = new Error('Invalid role. Role must be one of: admin, therapist, patient, superAdmin, therapistManager, supportAgent, contentModerator');
        error.statusCode = 400;
        throw error;
      }
      updateData.role = req.body.role;
    }

    if (currentUser.role === 'admin' && req.body.status !== undefined) {
      const validStatuses = ['active', 'inactive', 'pending', 'blocked', 'suspended'];
      if (!validStatuses.includes(req.body.status)) {
        const error: CustomError = new Error('Invalid status. Status must be one of: active, inactive, pending, blocked, or suspended');
        error.statusCode = 400;
        throw error;
      }
      updateData.status = req.body.status;
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'email') {
          updateData[field] = req.body[field].toLowerCase();
        } else {
          updateData[field as keyof IUser] = req.body[field];
        }
      }
    });

    if (req.body.password) {
      if (req.body.password.length < 6) {
        const error: CustomError = new Error('Password must be at least 6 characters in length');
        error.statusCode = 400;
        throw error;
      }
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(req.body.password, saltRounds);
      updateData.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    const files = (req as any).files;
    if (files && 'profilePhoto' in files) {
      const file = Array.isArray(files.profilePhoto)
        ? files.profilePhoto[0]
        : files.profilePhoto;
      if (file) {
        const userId = id;
        const baseFolder = `users/${userId}`;
        try {
          const result = await uploadToCloudinary(file, `${baseFolder}/profile-photos`);
          updateData.profilePhoto = result.url;
        } catch (uploadError) {
          const error: CustomError = new Error(`Failed to upload profile photo: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          error.statusCode = 500;
          throw error;
        }
      }
    } else if (req.body.profilePhoto !== undefined) {
      updateData.profilePhoto = req.body.profilePhoto || null;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('therapist', 'firstName lastName email');

    if (!updatedUser) {
      const error: CustomError = new Error('Failed to update user information. Please try again.');
      error.statusCode = 500;
      throw error;
    }

    if (updatedUser.role === 'therapist' && updatedUser.therapist) {
      const therapistId = typeof updatedUser.therapist === 'object' && updatedUser.therapist !== null && '_id' in updatedUser.therapist
        ? (updatedUser.therapist as any)._id
        : updatedUser.therapist;

      const therapistUpdateData: any = {};

      if (updateData.firstName !== undefined) {
        therapistUpdateData.firstName = updateData.firstName;
      }
      if (updateData.lastName !== undefined) {
        therapistUpdateData.lastName = updateData.lastName;
      }
      if (updateData.email !== undefined) {
        therapistUpdateData.email = updateData.email;
      }
      if (updateData.phone !== undefined) {
        const phoneString = updateData.phone.countryCode && updateData.phone.number
          ? `${updateData.phone.countryCode}${updateData.phone.number}`
          : undefined;
        if (phoneString) {
          therapistUpdateData.phone = phoneString;
        }
      }
      if (updateData.dateOfBirth !== undefined) {
        therapistUpdateData.dateOfBirth = updateData.dateOfBirth;
      }
      if (updateData.gender !== undefined) {
        therapistUpdateData.gender = updateData.gender;
      }
      if (updateData.country !== undefined) {
        therapistUpdateData.country = updateData.country;
      }

      if (Object.keys(therapistUpdateData).length > 0) {
        await Therapist.findByIdAndUpdate(
          therapistId,
          { $set: therapistUpdateData },
          { new: true, runValidators: true }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'User information updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (soft delete)
export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: id, deletedAt: null });
    if (!user) {
      const error: CustomError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const currentUser = await User.findOne({ _id: userId, deletedAt: null });
    if (!currentUser) {
      const error: CustomError = new Error('Current user not found');
      error.statusCode = 404;
      throw error;
    }

    if (id !== userId && currentUser.role !== 'admin') {
      const error: CustomError = new Error('Unauthorized. You can only delete your own profile');
      error.statusCode = 403;
      throw error;
    }

    if (user.role === 'therapist' && user.therapist) {
      await Therapist.findByIdAndUpdate(user.therapist, { deletedAt: new Date() });
    }

    await User.findByIdAndUpdate(id, { deletedAt: new Date() });

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
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
    const { reason, password } = req.body;

    if (!userId) throw { statusCode: 401, message: "User not authenticated" };
    if (!password) throw { statusCode: 400, message: "Password is required" };

    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) throw { statusCode: 404, message: "User not found" };

    if (!user.password) throw { statusCode: 400, message: "Account has no password set" };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw { statusCode: 401, message: "Invalid password" };

    if (user.role === "therapist") {
      const result = await Therapist.findByIdAndUpdate(
        user.therapist,
        { deletedAt: new Date() }
      );

      if (!result) console.warn("Therapist not found or already deleted");
    }

    await User.findByIdAndUpdate(userId, {
      deletedAt: new Date(),
      accountDeletionReason: reason || null,
      $inc: { tokenVersion: 1 }
    });

    res.status(200).json({ success: true, message: "Your account has been deleted successfully" });

  } catch (error: any) {
    next({ statusCode: error.statusCode || 500, message: error.message });
  }
};

