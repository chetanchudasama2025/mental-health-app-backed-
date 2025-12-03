import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

// Create a new payment
export const createPayment = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            amount,
            currency,
            paymentIntentId,
            clientSecret,
            status,
            receiptUrl,
            paymentMethod,
            description,
            metadata,
        } = req.body;

        if (!amount || !paymentIntentId || !clientSecret) {
            const error: CustomError = new Error('Amount, paymentIntentId, and clientSecret are required');
            error.statusCode = 400;
            throw error;
        }

        if (amount <= 0) {
            const error: CustomError = new Error('Amount must be greater than 0');
            error.statusCode = 400;
            throw error;
        }

        if (status && !['pending', 'succeeded', 'failed', 'refunded'].includes(status)) {
            const error: CustomError = new Error('Invalid status. Status must be one of: pending, succeeded, failed, refunded');
            error.statusCode = 400;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findOne({ _id: userId, deletedAt: null });
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const existingPayment = await Payment.findOne({
            paymentIntentId,
            deletedAt: null,
        });

        if (existingPayment) {
            const error: CustomError = new Error('Payment with this paymentIntentId already exists');
            error.statusCode = 409;
            throw error;
        }

        const payment = new Payment({
            user: userId,
            amount,
            currency: currency || 'usd',
            paymentIntentId,
            clientSecret,
            status: status || 'pending',
            receiptUrl: receiptUrl || null,
            paymentMethod: paymentMethod || null,
            description: description || null,
            metadata: metadata || {},
        });

        await payment.save();
        await payment.populate('user', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Payment created successfully',
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

// Get all payments with filters
export const getAllPayments = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            userId,
            status,
            currency,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            page = '1',
            limit = '10',
        } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = { deletedAt: null };

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId as string)) {
                const error: CustomError = new Error('Invalid user ID');
                error.statusCode = 400;
                throw error;
            }
            filter.user = userId;
        }

        if (status) {
            if (!['pending', 'succeeded', 'failed', 'refunded'].includes(status as string)) {
                const error: CustomError = new Error('Invalid status');
                error.statusCode = 400;
                throw error;
            }
            filter.status = status;
        }

        if (currency) {
            filter.currency = currency;
        }

        if (minAmount) {
            filter.amount = { ...filter.amount, $gte: parseFloat(minAmount as string) };
        }

        if (maxAmount) {
            filter.amount = { ...filter.amount, $lte: parseFloat(maxAmount as string) };
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate as string);
                if (!isNaN(start.getTime())) {
                    filter.createdAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate as string);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = end;
                }
            }
        }

        const payments = await Payment.find(filter)
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        const total = await Payment.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Payments fetched successfully',
            data: {
                payments,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get payment by ID
export const getPaymentById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid payment ID');
            error.statusCode = 400;
            throw error;
        }

        const payment = await Payment.findOne({ _id: id, deletedAt: null })
            .populate('user', 'firstName lastName email');

        if (!payment) {
            const error: CustomError = new Error('Payment not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Payment fetched successfully',
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

// Get payments by user (current authenticated user)
export const getMyPayments = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const {
            status,
            currency,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            page = '1',
            limit = '10',
        } = req.query;

        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = { user: userId, deletedAt: null };

        if (status) {
            if (!['pending', 'succeeded', 'failed', 'refunded'].includes(status as string)) {
                const error: CustomError = new Error('Invalid status');
                error.statusCode = 400;
                throw error;
            }
            filter.status = status;
        }

        if (currency) {
            filter.currency = currency;
        }

        if (minAmount) {
            filter.amount = { ...filter.amount, $gte: parseFloat(minAmount as string) };
        }

        if (maxAmount) {
            filter.amount = { ...filter.amount, $lte: parseFloat(maxAmount as string) };
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate as string);
                if (!isNaN(start.getTime())) {
                    filter.createdAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate as string);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = end;
                }
            }
        }

        const payments = await Payment.find(filter)
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        const total = await Payment.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Your payments fetched successfully',
            data: {
                payments,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get payments by user ID
export const getPaymentsByUserId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId } = req.params;
        const {
            status,
            currency,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            page = '1',
            limit = '10',
        } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            const error: CustomError = new Error('Invalid user ID');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findOne({ _id: userId, deletedAt: null });
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = { user: userId, deletedAt: null };

        if (status) {
            if (!['pending', 'succeeded', 'failed', 'refunded'].includes(status as string)) {
                const error: CustomError = new Error('Invalid status');
                error.statusCode = 400;
                throw error;
            }
            filter.status = status;
        }

        if (currency) {
            filter.currency = currency;
        }

        if (minAmount) {
            filter.amount = { ...filter.amount, $gte: parseFloat(minAmount as string) };
        }

        if (maxAmount) {
            filter.amount = { ...filter.amount, $lte: parseFloat(maxAmount as string) };
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate as string);
                if (!isNaN(start.getTime())) {
                    filter.createdAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate as string);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = end;
                }
            }
        }

        const payments = await Payment.find(filter)
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        const total = await Payment.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'User payments fetched successfully',
            data: {
                payments,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update payment
export const updatePayment = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            status,
            receiptUrl,
            paymentMethod,
            description,
            metadata,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid payment ID');
            error.statusCode = 400;
            throw error;
        }

        const payment = await Payment.findOne({ _id: id, deletedAt: null });
        if (!payment) {
            const error: CustomError = new Error('Payment not found');
            error.statusCode = 404;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findOne({ _id: userId, deletedAt: null });
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const isOwner = payment.user.toString() === userId;
        const isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to update this payment');
            error.statusCode = 403;
            throw error;
        }

        if (status !== undefined) {
            if (!['pending', 'succeeded', 'failed', 'refunded'].includes(status)) {
                const error: CustomError = new Error('Invalid status. Status must be one of: pending, succeeded, failed, refunded');
                error.statusCode = 400;
                throw error;
            }
            payment.status = status;
        }

        if (receiptUrl !== undefined) {
            payment.receiptUrl = receiptUrl || null;
        }

        if (paymentMethod !== undefined) {
            payment.paymentMethod = paymentMethod || null;
        }

        if (description !== undefined) {
            payment.description = description || null;
        }

        if (metadata !== undefined) {
            payment.metadata = metadata || {};
        }

        await payment.save();
        await payment.populate('user', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully',
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

// Delete payment (soft delete)
export const deletePayment = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid payment ID');
            error.statusCode = 400;
            throw error;
        }

        const payment = await Payment.findOne({ _id: id, deletedAt: null });
        if (!payment) {
            const error: CustomError = new Error('Payment not found');
            error.statusCode = 404;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findOne({ _id: userId, deletedAt: null });
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const isOwner = payment.user.toString() === userId;
        const isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to delete this payment');
            error.statusCode = 403;
            throw error;
        }

        payment.deletedAt = new Date();
        await payment.save();

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

