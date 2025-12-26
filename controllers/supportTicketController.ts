import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import {ISupportTicket, SupportTicket} from '../models/SupportTicket';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';
import {uploadToCloudinary} from '../middleware/uploadMiddleware';

/**
 * Generates a unique ticket number in format: TKT-YYYYMMDD-XXXXXX
 * @returns A unique ticket number
 */
const generateTicketNumber = async (): Promise<string> => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    let ticketNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        ticketNumber = `TKT-${datePrefix}-${randomPart}`;

        const existing = await SupportTicket.findOne({ticketNumber, deletedAt: null});
        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        throw new Error('Failed to generate unique ticket number after multiple attempts');
    }

    return ticketNumber!;
};

// Create a new support ticket
export const createSupportTicket = async (
    req: AuthRequest | Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            email,
            phone,
            userType,
            issueCategory,
            subject,
            description,
            priority,
            userId: bodyUserId,
        } = req.body;

        const userId = (req as AuthRequest).user?._id || bodyUserId;

        if (!email || !userType || !issueCategory || !subject || !description) {
            const error: CustomError = new Error('All required fields must be provided');
            error.statusCode = 400;
            throw error;
        }

        if (!userId) {
            const error: CustomError = new Error('User ID is required. Please authenticate or provide userId in request body.');
            error.statusCode = 400;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            const error: CustomError = new Error('Invalid userId');
            error.statusCode = 400;
            throw error;
        }

        if (!['patient', 'therapist'].includes(userType)) {
            const error: CustomError = new Error('Invalid user type. Must be either "patient" or "therapist"');
            error.statusCode = 400;
            throw error;
        }

        const validCategories = [
            'billing_refunds',
            'technical_support',
            'session_support',
            'account_issues',
            'platform_features',
            'therapist_concerns',
            'general_inquiry',
        ];

        if (!validCategories.includes(issueCategory)) {
            const error: CustomError = new Error('Invalid issue category. Please select a valid category.');
            error.statusCode = 400;
            throw error;
        }

        if (priority && !['low', 'medium', 'high'].includes(priority)) {
            const error: CustomError = new Error('Invalid priority level. Must be one of: low, medium, or high');
            error.statusCode = 400;
            throw error;
        }

        const ticketNumber = await generateTicketNumber();

        const supportTicket = new SupportTicket({
            userId: new mongoose.Types.ObjectId(userId),
            ticketNumber,
            email: email.toLowerCase().trim(),
            phone: phone || null,
            userType,
            issueCategory,
            subject: subject.trim(),
            description: description.trim(),
            priority: priority || 'low',
            attachmentUrls: [],
            status: 'open',
        });

        await supportTicket.save();

        const files = (req as any).files;
        let attachmentUrls: string[] = [];

        if (files && Array.isArray(files) && files.length > 0) {
            const ticketId = (supportTicket._id as mongoose.Types.ObjectId).toString();
            const baseFolder = `support-tickets/${ticketId}/attachments`;
            const uploadPromises = files.map((file: any) =>
                uploadToCloudinary(file, baseFolder)
            );
            const results = await Promise.all(uploadPromises);
            attachmentUrls = results.map((r: { url: string; publicId: string }) => r.url);

            if (attachmentUrls.length > 0) {
                supportTicket.attachmentUrls = attachmentUrls;
                await supportTicket.save();
            }
        }

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully. Our team will review it shortly.',
            data: supportTicket,
        });
    } catch (error) {
        next(error);
    }
};

// Get all support tickets
export const getAllSupportTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            page = '1',
            limit = '10',
            search,
            userType,
            issueCategory,
            status,
            priority,
            email,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const query: any = {deletedAt: null};

        if (search) {
            query.$or = [
                {subject: {$regex: search, $options: 'i'}},
                {description: {$regex: search, $options: 'i'}},
                {email: {$regex: search, $options: 'i'}},
                {ticketNumber: {$regex: search, $options: 'i'}},
            ];
        }

        if (userType) {
            if (!['patient', 'therapist'].includes(userType as string)) {
                const error: CustomError = new Error('Invalid userType filter');
                error.statusCode = 400;
                throw error;
            }
            query.userType = userType;
        }

        if (issueCategory) {
            query.issueCategory = issueCategory;
        }

        if (status) {
            if (!['open', 'in_progress', 'resolved', 'closed'].includes(status as string)) {
                const error: CustomError = new Error('Invalid status filter');
                error.statusCode = 400;
                throw error;
            }
            query.status = status;
        }

        if (priority) {
            if (!['low', 'medium', 'high'].includes(priority as string)) {
                const error: CustomError = new Error('Invalid priority filter');
                error.statusCode = 400;
                throw error;
            }
            query.priority = priority;
        }

        if (email) {
            query.email = {$regex: email as string, $options: 'i'};
        }

        const ticketNumber = req.query.ticketNumber as string;
        if (ticketNumber) {
            query.ticketNumber = {$regex: ticketNumber.trim().toUpperCase(), $options: 'i'};
        }

        const supportTickets = await SupportTicket.find(query)
            .populate('userId', 'firstName lastName email role')
            .skip(skip)
            .limit(limitNum)
            .sort({createdAt: -1});

        const total = await SupportTicket.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Support tickets retrieved successfully',
            data: {
                supportTickets,
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

// Get a single support ticket by ID
export const getSupportTicketById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid support ticket ID');
            error.statusCode = 400;
            throw error;
        }

        const supportTicket = await SupportTicket.findOne({_id: id, deletedAt: null})
            .populate('userId', 'firstName lastName email role');

        if (!supportTicket) {
            const error: CustomError = new Error('Support ticket not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Support ticket information retrieved successfully',
            data: supportTicket,
        });
    } catch (error) {
        next(error);
    }
};

// Get a single support ticket by ticket number
export const getSupportTicketByTicketNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {ticketNumber} = req.params;

        if (!ticketNumber || typeof ticketNumber !== 'string') {
            const error: CustomError = new Error('Ticket number is required');
            error.statusCode = 400;
            throw error;
        }

        const supportTicket = await SupportTicket.findOne({
            ticketNumber: ticketNumber.trim().toUpperCase(),
            deletedAt: null
        })
            .populate('userId', 'firstName lastName email role');

        if (!supportTicket) {
            const error: CustomError = new Error('Support ticket not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Support ticket information retrieved successfully',
            data: supportTicket,
        });
    } catch (error) {
        next(error);
    }
};

// Update support ticket
export const updateSupportTicket = async (
    req: AuthRequest | Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {
            email,
            phone,
            userType,
            issueCategory,
            subject,
            description,
            priority,
            attachmentUrls: bodyAttachmentUrls,
            status,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid support ticket ID');
            error.statusCode = 400;
            throw error;
        }

        const supportTicket = await SupportTicket.findOne({_id: id, deletedAt: null});
        if (!supportTicket) {
            const error: CustomError = new Error('Support ticket not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData: Partial<ISupportTicket> = {};

        const files = (req as any).files;
        let attachmentUrls: string[] = bodyAttachmentUrls || supportTicket.attachmentUrls || [];

        if (files && Array.isArray(files) && files.length > 0) {
            const baseFolder = `support-tickets/${id}/attachments`;
            const uploadPromises = files.map((file: any) =>
                uploadToCloudinary(file, baseFolder)
            );
            const results = await Promise.all(uploadPromises);
            const newAttachmentUrls = results.map((r: { url: string; publicId: string }) => r.url);

            if (bodyAttachmentUrls === undefined) {
                attachmentUrls = [...(supportTicket.attachmentUrls || []), ...newAttachmentUrls];
            } else {
                attachmentUrls = newAttachmentUrls;
            }
        }

        if (email !== undefined) {
            updateData.email = email.toLowerCase().trim();
        }

        if (phone !== undefined) {
            updateData.phone = phone || null;
        }

        if (userType !== undefined) {
            if (!['patient', 'therapist'].includes(userType)) {
                const error: CustomError = new Error('Invalid userType. Must be either "patient" or "therapist"');
                error.statusCode = 400;
                throw error;
            }
            updateData.userType = userType;
        }

        if (issueCategory !== undefined) {
            const validCategories = [
                'billing_refunds',
                'technical_support',
                'session_support',
                'account_issues',
                'platform_features',
                'therapist_concerns',
                'general_inquiry',
            ];
            if (!validCategories.includes(issueCategory)) {
                const error: CustomError = new Error('Invalid issueCategory');
                error.statusCode = 400;
                throw error;
            }
            updateData.issueCategory = issueCategory;
        }

        if (subject !== undefined) {
            updateData.subject = subject.trim();
        }

        if (description !== undefined) {
            updateData.description = description.trim();
        }

        if (priority !== undefined) {
            if (!['low', 'medium', 'high'].includes(priority)) {
                const error: CustomError = new Error('Invalid priority. Must be one of: low, medium, high');
                error.statusCode = 400;
                throw error;
            }
            updateData.priority = priority;
        }

        if (bodyAttachmentUrls !== undefined || (files && Array.isArray(files) && files.length > 0)) {
            updateData.attachmentUrls = attachmentUrls;
        }

        if (status !== undefined) {
            if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
                const error: CustomError = new Error('Invalid status. Must be one of: open, in_progress, resolved, closed');
                error.statusCode = 400;
                throw error;
            }
            updateData.status = status;
        }

        const updatedSupportTicket = await SupportTicket.findByIdAndUpdate(
            id,
            {$set: updateData},
            {new: true, runValidators: true}
        ).populate('userId', 'firstName lastName email role');

        if (!updatedSupportTicket) {
            const error: CustomError = new Error('Failed to update support ticket. Please try again.');
            error.statusCode = 500;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Support ticket information updated successfully',
            data: updatedSupportTicket,
        });
    } catch (error) {
        next(error);
    }
};

// Delete support ticket
export const deleteSupportTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid support ticket ID');
            error.statusCode = 400;
            throw error;
        }

        const supportTicket = await SupportTicket.findOne({_id: id, deletedAt: null});
        if (!supportTicket) {
            const error: CustomError = new Error('Support ticket not found');
            error.statusCode = 404;
            throw error;
        }

        await SupportTicket.findByIdAndUpdate(id, {deletedAt: new Date()});

        res.status(200).json({
            success: true,
            message: 'Support ticket has been deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

