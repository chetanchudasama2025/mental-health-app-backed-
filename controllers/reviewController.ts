import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import {TherapistReview, ITherapistReview} from '../models/Review';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';
import {uploadToCloudinary} from '../middleware/uploadMiddleware';
import Therapist from '../models/Therapist';
import Booking from '../models/Booking';

// Create a new review
export const createReview = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      therapistId,
      rating,
      review,
      isAnonymous,
      sessionId,
      remarks,
    } = req.body;

    const reviewerId = (req as AuthRequest).user?._id;

    if (!reviewerId) {
      const error: CustomError = new Error('User must be authenticated to create a review');
      error.statusCode = 401;
      throw error;
    }

    if (!therapistId || !rating || !review || !sessionId) {
      const error: CustomError = new Error('Therapist ID, rating, review text, and session ID are required');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      const error: CustomError = new Error('Invalid therapist ID');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      const error: CustomError = new Error('Invalid session ID');
      error.statusCode = 400;
      throw error;
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      const error: CustomError = new Error('Rating must be an integer between 1 and 5');
      error.statusCode = 400;
      throw error;
    }

    const trimmedReview = review.trim();
    if (trimmedReview.length === 0) {
      const error: CustomError = new Error('Review text cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    if (trimmedReview.length < 10) {
      const error: CustomError = new Error('Review text must be at least 10 characters long');
      error.statusCode = 400;
      throw error;
    }
    if (trimmedReview.length > 2000) {
      const error: CustomError = new Error('Review text cannot exceed 2000 characters');
      error.statusCode = 400;
      throw error;
    }

    // Verify therapist exists
    const therapist = await Therapist.findOne({ _id: therapistId, deletedAt: null });
    if (!therapist) {
      const error: CustomError = new Error('Therapist not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify session exists and belongs to the reviewer
    const session = await Booking.findOne({ 
      _id: sessionId, 
      deletedAt: null,
      patient: reviewerId 
    });
    if (!session) {
      const error: CustomError = new Error('Session not found or you do not have permission to review this session');
      error.statusCode = 404;
      throw error;
    }

    // Verify session is completed
    if (session.status !== 'completed') {
      const error: CustomError = new Error('You can only review completed sessions');
      error.statusCode = 400;
      throw error;
    }

    // Check if review already exists for this session
    const existingReview = await TherapistReview.findOne({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      reviewer: new mongoose.Types.ObjectId(reviewerId),
      deletedAt: null,
    });

    if (existingReview) {
      const error: CustomError = new Error('You have already reviewed this session');
      error.statusCode = 409;
      throw error;
    }

    // Verify therapist matches the session
    if (session.therapist.toString() !== therapistId) {
      const error: CustomError = new Error('Therapist ID does not match the session therapist');
      error.statusCode = 400;
      throw error;
    }

    const newReview = new TherapistReview({
      therapist: new mongoose.Types.ObjectId(therapistId),
      reviewer: new mongoose.Types.ObjectId(reviewerId),
      rating: Number(rating),
      review: review.trim(),
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
      sessionId: new mongoose.Types.ObjectId(sessionId),
      status: 'pending',
      remarks: remarks ? remarks.trim() : null,
      attachments: [],
    });

    // Handle file uploads if any
    const files = (req as any).files;
    if (files && Array.isArray(files) && files.length > 0) {
      const reviewId = (newReview._id as mongoose.Types.ObjectId).toString();
      const baseFolder = `reviews/${reviewId}`;
      const uploadPromises = files.map((file: any) =>
        uploadToCloudinary(file, baseFolder)
      );
      const results = await Promise.all(uploadPromises);
      newReview.attachments = results.map((r: { url: string; publicId: string }) => r.url);
    }

    await newReview.save();
    await newReview.populate([
      { path: 'therapist', select: 'firstName lastName profilePhoto' },
      { path: 'reviewer', select: 'firstName lastName profilePhoto' },
      { path: 'sessionId', select: 'date time status' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and is pending approval',
      data: newReview,
    });
  } catch (error) {
    next(error);
  }
};

// Get all reviews with filters
export const getAllReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      therapistId,
      reviewerId,
      status,
      rating,
      search,
      minRating,
      maxRating,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = { deletedAt: null };

    if (therapistId) {
      if (!mongoose.Types.ObjectId.isValid(therapistId as string)) {
        const error: CustomError = new Error('Invalid therapist ID');
        error.statusCode = 400;
        throw error;
      }
      query.therapist = new mongoose.Types.ObjectId(therapistId as string);
    }

    if (reviewerId) {
      if (!mongoose.Types.ObjectId.isValid(reviewerId as string)) {
        const error: CustomError = new Error('Invalid reviewer ID');
        error.statusCode = 400;
        throw error;
      }
      query.reviewer = new mongoose.Types.ObjectId(reviewerId as string);
    }

    if (status) {
      if (!['pending', 'approved', 'rejected'].includes(status as string)) {
        const error: CustomError = new Error('Invalid status filter');
        error.statusCode = 400;
        throw error;
      }
      query.status = status;
    }

    if (rating) {
      const ratingNum = parseInt(rating as string, 10);
      if (ratingNum < 1 || ratingNum > 5) {
        const error: CustomError = new Error('Rating must be between 1 and 5');
        error.statusCode = 400;
        throw error;
      }
      query.rating = ratingNum;
    }

    if (minRating) {
      const minRatingNum = parseInt(minRating as string, 10);
      if (minRatingNum < 1 || minRatingNum > 5) {
        const error: CustomError = new Error('Minimum rating must be between 1 and 5');
        error.statusCode = 400;
        throw error;
      }
      query.rating = { ...query.rating, $gte: minRatingNum };
    }

    if (maxRating) {
      const maxRatingNum = parseInt(maxRating as string, 10);
      if (maxRatingNum < 1 || maxRatingNum > 5) {
        const error: CustomError = new Error('Maximum rating must be between 1 and 5');
        error.statusCode = 400;
        throw error;
      }
      query.rating = { ...query.rating, $lte: maxRatingNum };
    }

    if (search) {
      query.$or = [
        { review: { $regex: search, $options: 'i' } },
        { remarks: { $regex: search, $options: 'i' } },
      ];
    }

    const reviews = await TherapistReview.find(query)
      .populate('therapist', 'firstName lastName profilePhoto')
      .populate('reviewer', 'firstName lastName profilePhoto')
      .populate('sessionId', 'date time status')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await TherapistReview.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
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

// Get reviews by therapist ID
export const getReviewsByTherapist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { therapistId } = req.params;
    const {
      page = '1',
      limit = '10',
      status = 'approved',
      minRating,
    } = req.query;

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

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {
      therapist: new mongoose.Types.ObjectId(therapistId),
      deletedAt: null,
      status: status || 'approved',
    };

    if (minRating) {
      const minRatingNum = parseInt(minRating as string, 10);
      if (minRatingNum >= 1 && minRatingNum <= 5) {
        query.rating = { $gte: minRatingNum };
      }
    }

    const reviews = await TherapistReview.find(query)
      .populate('reviewer', 'firstName lastName profilePhoto')
      .populate('sessionId', 'date time')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await TherapistReview.countDocuments(query);

    // Calculate average rating
    const ratingStats = await TherapistReview.aggregate([
      {
        $match: {
          therapist: new mongoose.Types.ObjectId(therapistId),
          deletedAt: null,
          status: 'approved',
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    const stats = ratingStats[0] || {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [],
    };

    // Calculate rating distribution
    const distribution = {
      5: stats.ratingDistribution.filter((r: number) => r === 5).length,
      4: stats.ratingDistribution.filter((r: number) => r === 4).length,
      3: stats.ratingDistribution.filter((r: number) => r === 3).length,
      2: stats.ratingDistribution.filter((r: number) => r === 2).length,
      1: stats.ratingDistribution.filter((r: number) => r === 1).length,
    };

    res.status(200).json({
      success: true,
      message: 'Therapist reviews retrieved successfully',
      data: {
        reviews,
        stats: {
          averageRating: Math.round((stats.averageRating || 0) * 10) / 10,
          totalReviews: stats.totalReviews,
          distribution,
        },
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

// Get reviews by reviewer (current user)
export const getMyReviews = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reviewerId = req.user?._id;

    if (!reviewerId) {
      const error: CustomError = new Error('User must be authenticated');
      error.statusCode = 401;
      throw error;
    }

    const {
      page = '1',
      limit = '10',
      status,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {
      reviewer: new mongoose.Types.ObjectId(reviewerId),
      deletedAt: null,
    };

    if (status) {
      if (!['pending', 'approved', 'rejected'].includes(status as string)) {
        const error: CustomError = new Error('Invalid status filter');
        error.statusCode = 400;
        throw error;
      }
      query.status = status;
    }

    const reviews = await TherapistReview.find(query)
      .populate('therapist', 'firstName lastName profilePhoto')
      .populate('sessionId', 'date time status')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await TherapistReview.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Your reviews retrieved successfully',
      data: {
        reviews,
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

// Get a single review by ID
export const getReviewById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid review ID');
      error.statusCode = 400;
      throw error;
    }

    const review = await TherapistReview.findOne({ _id: id, deletedAt: null })
      .populate('therapist', 'firstName lastName profilePhoto email')
      .populate('reviewer', 'firstName lastName profilePhoto')
      .populate('sessionId', 'date time status duration');

    if (!review) {
      const error: CustomError = new Error('Review not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Review retrieved successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Update review
export const updateReview = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      rating,
      review,
      isAnonymous,
      remarks,
      status,
      attachments: bodyAttachments,
    } = req.body;

    const userId = (req as AuthRequest).user?._id;
    const userRole = (req as AuthRequest).user?.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid review ID');
      error.statusCode = 400;
      throw error;
    }

    const existingReview = await TherapistReview.findOne({ _id: id, deletedAt: null });
    if (!existingReview) {
      const error: CustomError = new Error('Review not found');
      error.statusCode = 404;
      throw error;
    }

    // Check permissions: reviewer can update their own review (if pending), admins can update status
    const isOwner = userId && existingReview.reviewer.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin' || userRole === 'contentModerator';

    if (!isOwner && !isAdmin) {
      const error: CustomError = new Error('You do not have permission to update this review');
      error.statusCode = 403;
      throw error;
    }

    // Reviewers can only update pending reviews
    if (isOwner && !isAdmin && existingReview.status !== 'pending') {
      const error: CustomError = new Error('You can only update pending reviews');
      error.statusCode = 400;
      throw error;
    }

    const updateData: Partial<ITherapistReview> = {};

    // Handle file uploads
    const files = (req as any).files;
    let attachments: string[] = bodyAttachments || existingReview.attachments || [];

    if (files && Array.isArray(files) && files.length > 0) {
      const baseFolder = `reviews/${id}`;
      const uploadPromises = files.map((file: any) =>
        uploadToCloudinary(file, baseFolder)
      );
      const results = await Promise.all(uploadPromises);
      const newAttachmentUrls = results.map((r: { url: string; publicId: string }) => r.url);

      if (bodyAttachments === undefined) {
        attachments = [...(existingReview.attachments || []), ...newAttachmentUrls];
      } else {
        attachments = newAttachmentUrls;
      }
    }

    // Only reviewers can update these fields
    if (isOwner && !isAdmin) {
      if (rating !== undefined) {
        if (rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
          const error: CustomError = new Error('Rating must be an integer between 1 and 5');
          error.statusCode = 400;
          throw error;
        }
        updateData.rating = Number(rating);
      }

      if (review !== undefined) {
        const trimmedReview = review.trim();
        if (trimmedReview.length === 0) {
          const error: CustomError = new Error('Review text cannot be empty');
          error.statusCode = 400;
          throw error;
        }
        if (trimmedReview.length < 10) {
          const error: CustomError = new Error('Review text must be at least 10 characters long');
          error.statusCode = 400;
          throw error;
        }
        if (trimmedReview.length > 2000) {
          const error: CustomError = new Error('Review text cannot exceed 2000 characters');
          error.statusCode = 400;
          throw error;
        }
        updateData.review = trimmedReview;
      }

      if (isAnonymous !== undefined) {
        updateData.isAnonymous = isAnonymous === true || isAnonymous === 'true';
      }

      if (remarks !== undefined) {
        updateData.remarks = remarks ? remarks.trim() : null;
      }

      if (bodyAttachments !== undefined || (files && Array.isArray(files) && files.length > 0)) {
        updateData.attachments = attachments;
      }
    }

    // Only admins can update status
    if (isAdmin && status !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        const error: CustomError = new Error('Invalid status. Must be one of: pending, approved, rejected');
        error.statusCode = 400;
        throw error;
      }
      updateData.status = status;
    }

    // Admins can also update remarks
    if (isAdmin && remarks !== undefined) {
      updateData.remarks = remarks ? remarks.trim() : null;
    }

    const updatedReview = await TherapistReview.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('therapist', 'firstName lastName profilePhoto')
      .populate('reviewer', 'firstName lastName profilePhoto')
      .populate('sessionId', 'date time status');

    if (!updatedReview) {
      const error: CustomError = new Error('Failed to update review. Please try again.');
      error.statusCode = 500;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview,
    });
  } catch (error) {
    next(error);
  }
};

// Delete review (soft delete)
export const deleteReview = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const userId = (req as AuthRequest).user?._id;
    const userRole = (req as AuthRequest).user?.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid review ID');
      error.statusCode = 400;
      throw error;
    }

    const review = await TherapistReview.findOne({ _id: id, deletedAt: null });
    if (!review) {
      const error: CustomError = new Error('Review not found');
      error.statusCode = 404;
      throw error;
    }

    // Check permissions: reviewer can delete their own review, admins can delete any
    const isOwner = userId && review.reviewer.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin' || userRole === 'contentModerator';

    if (!isOwner && !isAdmin) {
      const error: CustomError = new Error('You do not have permission to delete this review');
      error.statusCode = 403;
      throw error;
    }

    await TherapistReview.findByIdAndUpdate(id, { deletedAt: new Date() });

    res.status(200).json({
      success: true,
      message: 'Review has been deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
