import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import Availability, {IAvailability} from '../models/Availability';
import Therapist from '../models/Therapist';
import {User} from '../models/User';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';

// Create a new availability
export const createAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      therapistId,
      timeZone,
      bufferTime,
      price,
      sessionDuration,
      serviceEnabled,
      availabilityCalendar,
    } = req.body;

    if (!therapistId || !timeZone || !bufferTime || !price || !sessionDuration) {
      const error: CustomError = new Error('Therapist ID, timezone, buffer time, price, and session duration are required');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      const error: CustomError = new Error('Invalid therapist ID');
      error.statusCode = 400;
      throw error;
    }

    const therapist = await Therapist.findOne({ _id: therapistId, deletedAt: null });
    if (!therapist) {
      const error: CustomError = new Error('Therapist not found');
      error.statusCode = 404;
      throw error;
    }

    const existingAvailability = await Availability.findOne({ therapistId });
    if (existingAvailability) {
      const error: CustomError = new Error('An availability schedule already exists for this therapist. Please update the existing schedule instead.');
      error.statusCode = 409;
      throw error;
    }

    const availability = new Availability({
      therapistId,
      timeZone,
      bufferTime,
      price,
      sessionDuration,
      serviceEnabled: serviceEnabled || false,
      availabilityCalendar: availabilityCalendar || [],
    });

    await availability.save();

    const populatedAvailability = await Availability.findById(availability._id)
      .populate('therapistId', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Availability schedule created successfully',
      data: populatedAvailability,
    });
  } catch (error) {
    next(error);
  }
};

// Get all availabilities
export const getAllAvailabilities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      therapistId,
      serviceEnabled,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};

    if (therapistId) {
      if (!mongoose.Types.ObjectId.isValid(therapistId as string)) {
        const error: CustomError = new Error('Invalid therapist ID');
        error.statusCode = 400;
        throw error;
      }
      query.therapistId = therapistId;
    }

    if (serviceEnabled !== undefined) {
      query.serviceEnabled = serviceEnabled === 'true';
    }

    const availabilities = await Availability.find(query)
      .populate('therapistId', 'firstName lastName email')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Availability.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Availability schedules retrieved successfully',
      data: {
        availabilities,
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

// Get a single availability by ID
export const getAvailabilityById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid availability ID');
      error.statusCode = 400;
      throw error;
    }

    const availability = await Availability.findById(id)
      .populate('therapistId', 'firstName lastName email');

    if (!availability) {
      const error: CustomError = new Error('Availability not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Availability information retrieved successfully',
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// Get availability by therapist ID
export const getAvailabilityByTherapistId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { therapistId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      const error: CustomError = new Error('Invalid therapist ID');
      error.statusCode = 400;
      throw error;
    }

    const availability = await Availability.findOne({ therapistId })
      .populate('therapistId', 'firstName lastName email');

    if (!availability) {
      const error: CustomError = new Error('No availability schedule found for this therapist');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Availability information retrieved successfully',
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// Update availability
export const updateAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      timeZone,
      bufferTime,
      price,
      sessionDuration,
      serviceEnabled,
      availabilityCalendar,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid availability ID');
      error.statusCode = 400;
      throw error;
    }

    const availability = await Availability.findById(id);
    if (!availability) {
      const error: CustomError = new Error('Availability not found');
      error.statusCode = 404;
      throw error;
    }

    const userId = req.user?._id;
    if (userId) {
      const therapist = await Therapist.findOne({
        _id: availability.therapistId,
        deletedAt: null
      });

      if (therapist) {
        const therapistUser = await User.findOne({
          _id: therapist.user,
          deletedAt: null
        });

        if (therapistUser) {
          const therapistUserId = (therapistUser._id as mongoose.Types.ObjectId).toString();
          if (therapistUserId !== userId && therapistUser.role !== 'admin') {
            const error: CustomError = new Error('Unauthorized. You can only update your own availability schedule');
            error.statusCode = 403;
            throw error;
          }
        }
      }
    }

    const updateData: Partial<IAvailability> = {};

    if (timeZone !== undefined) updateData.timeZone = timeZone;
    if (bufferTime !== undefined) updateData.bufferTime = bufferTime;
    if (price !== undefined) updateData.price = price;
    if (sessionDuration !== undefined) updateData.sessionDuration = sessionDuration;
    if (serviceEnabled !== undefined) updateData.serviceEnabled = serviceEnabled;
    if (availabilityCalendar !== undefined) updateData.availabilityCalendar = availabilityCalendar;

    const updatedAvailability = await Availability.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('therapistId', 'firstName lastName email');

    if (!updatedAvailability) {
      const error: CustomError = new Error('Failed to update availability schedule. Please try again.');
      error.statusCode = 500;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Availability schedule updated successfully',
      data: updatedAvailability,
    });
  } catch (error) {
    next(error);
  }
};

// Delete availability
export const deleteAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid availability ID');
      error.statusCode = 400;
      throw error;
    }

    const availability = await Availability.findById(id);
    if (!availability) {
      const error: CustomError = new Error('Availability not found');
      error.statusCode = 404;
      throw error;
    }

    const userId = req.user?._id;
    if (userId) {
      const therapist = await Therapist.findOne({
        _id: availability.therapistId,
        deletedAt: null
      });

      if (therapist) {
        const therapistUser = await User.findOne({
          _id: therapist.user,
          deletedAt: null
        });

        if (therapistUser) {
          const therapistUserId = (therapistUser._id as mongoose.Types.ObjectId).toString();
          if (therapistUserId !== userId && therapistUser.role !== 'admin') {
            const error: CustomError = new Error('Unauthorized. You can only delete your own availability schedule');
            error.statusCode = 403;
            throw error;
          }
        }
      }
    }

    await Availability.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Availability schedule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

