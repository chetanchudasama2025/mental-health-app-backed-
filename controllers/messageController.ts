import {NextFunction, Response} from 'express';
import mongoose from 'mongoose';
import {Conversation} from '../models/Conversation';
import {Message} from '../models/Message';
import {User} from '../models/User';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';

// Get or create a conversation between two users
export const getOrCreateConversation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {participantId} = req.body;
        const currentUserId = req.user!._id;

        if (!participantId) {
            const error: CustomError = new Error('Participant ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(participantId)) {
            const error: CustomError = new Error('Invalid participant ID');
            error.statusCode = 400;
            throw error;
        }

        if (participantId === currentUserId) {
            const error: CustomError = new Error('You cannot create a conversation with yourself');
            error.statusCode = 400;
            throw error;
        }

        const participant = await User.findById(participantId);
        if (!participant) {
            const error: CustomError = new Error('Participant not found');
            error.statusCode = 404;
            throw error;
        }

        const existingConversation = await Conversation.findOne({
            participants: {$all: [currentUserId, participantId]},
            deletedAt: null,
        })
            .populate('participants', 'firstName lastName email role')
            .populate('lastMessage')
            .sort({lastMessageAt: -1});

        if (existingConversation) {
            const unreadCount = existingConversation.unreadCounts.get(currentUserId) || 0;

            res.status(200).json({
                success: true,
                message: 'Conversation information retrieved successfully',
                data: {
                    ...existingConversation.toObject(),
                    unreadCount,
                },
            });
            return;
        }

        const conversation = new Conversation({
            participants: [currentUserId, participantId],
            unreadCounts: new Map(),
        });

        await conversation.save();

        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'firstName lastName email role');

        res.status(201).json({
            success: true,
            message: 'Conversation created successfully',
            data: {
                ...populatedConversation!.toObject(),
                unreadCount: 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get all conversations for the current user
export const getUserConversations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const currentUserId = req.user!._id;
        const {page = 1, limit = 20} = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const conversations = await Conversation.find({
            participants: currentUserId,
            deletedAt: null,
        })
            .populate('participants', 'firstName lastName email role profilePhoto isOnline lastSeen')
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt readBy readAt',
                populate: [
                    {
                        path: 'sender',
                        select: 'firstName lastName profilePhoto',
                    },
                    {
                        path: 'readBy',
                        select: 'firstName lastName',
                    },
                ],
            })
            .sort({lastMessageAt: -1, updatedAt: -1})
            .skip(skip)
            .limit(limitNum);

        const formattedConversations = conversations.map((conv) => {
            const otherParticipant = conv.participants.find(
                (p: any) => p._id.toString() !== currentUserId
            ) as any;
            const unreadCount = conv.unreadCounts.get(currentUserId) || 0;

            return {
                _id: conv._id,
                otherParticipant: {
                    _id: otherParticipant?._id,
                    firstName: otherParticipant?.firstName,
                    lastName: otherParticipant?.lastName,
                    email: otherParticipant?.email,
                    role: otherParticipant?.role,
                    profilePhoto: otherParticipant?.profilePhoto,
                },
                lastMessage: conv.lastMessage,
                lastMessageAt: conv.lastMessageAt,
                unreadCount,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
            };
        });

        const total = await Conversation.countDocuments({
            participants: currentUserId,
            deletedAt: null,
        });

        res.status(200).json({
            success: true,
            message: 'Your conversations retrieved successfully',
            data: formattedConversations,
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

// Get a single conversation by ID
export const getConversationById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid conversation ID');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: id,
            participants: currentUserId,
            deletedAt: null,
        })
            .populate('participants', 'firstName lastName email role profilePhoto isOnline lastSeen')
            .populate({
                path: 'lastMessage',
                populate: [
                    {
                        path: 'sender',
                        select: 'firstName lastName profilePhoto',
                    },
                    {
                        path: 'readBy',
                        select: 'firstName lastName',
                    },
                ],
            });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        const otherParticipant = conversation.participants.find(
            (p: any) => p._id.toString() !== currentUserId
        ) as any;
        const unreadCount = conversation.unreadCounts.get(currentUserId) || 0;

        res.status(200).json({
            success: true,
            message: 'Conversation retrieved successfully',
            data: {
                ...conversation.toObject(),
                otherParticipant: {
                    _id: otherParticipant?._id,
                    firstName: otherParticipant?.firstName,
                    lastName: otherParticipant?.lastName,
                    email: otherParticipant?.email,
                    role: otherParticipant?.role,
                    profilePhoto: otherParticipant?.profilePhoto,
                },
                unreadCount,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get messages for a conversation
export const getConversationMessages = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;
        const {page = 1, limit = 50} = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid conversation ID');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: id,
            participants: currentUserId,
            deletedAt: null,
        });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const messages = await Message.find({
            conversation: id,
            deletedAt: null,
        })
            .populate('sender', 'firstName lastName email role profilePhoto')
            .populate('readBy', 'firstName lastName')
            .populate({
                path: 'replyTo',
                select: 'content sender attachmentUrl createdAt',
                populate: {
                    path: 'sender',
                    select: 'firstName lastName profilePhoto',
                },
            })
            .sort({createdAt: -1})
            .skip(skip)
            .limit(limitNum)
            .lean();

        messages.reverse();

        const total = await Message.countDocuments({
            conversation: id,
            deletedAt: null,
        });

        res.status(200).json({
            success: true,
            message: 'Messages retrieved successfully',
            data: messages,
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

// Upload file for chat message (images, videos, documents, etc.)
export const uploadChatFile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const file = (req as any).file;
        const currentUserId = req.user!._id;
        const currentUserFirstName = req.user!.firstName || '';
        const currentUserLastName = req.user!.lastName || '';
        const {conversationId} = req.body;

        if (!file) {
            const error: CustomError = new Error('No file provided');
            error.statusCode = 400;
            throw error;
        }

        const MAX_FILE_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const error: CustomError = new Error(
                `File size (${fileSizeMB} MB) exceeds the maximum allowed size of 50 MB. Please upload a smaller file.`
            );
            error.statusCode = 400;
            throw error;
        }

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
            const error: CustomError = new Error('Valid conversation ID is required');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: currentUserId,
            deletedAt: null,
        });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found or access denied');
            error.statusCode = 404;
            throw error;
        }

        const {uploadToCloudinary} = require('../middleware/uploadMiddleware');

        const sanitizeChatFolderName = (name: string): string => {
            if (!name || typeof name !== 'string') {
                return '';
            }
            return name
                .trim()
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
        };

        const sanitizedFirstName = sanitizeChatFolderName(currentUserFirstName);
        const sanitizedLastName = sanitizeChatFolderName(currentUserLastName);

        let userName = '';
        if (sanitizedFirstName && sanitizedLastName) {
            userName = `${sanitizedFirstName}_${sanitizedLastName}`;
        } else if (sanitizedFirstName) {
            userName = sanitizedFirstName;
        } else if (sanitizedLastName) {
            userName = sanitizedLastName;
        } else {
            userName = 'user';
        }

        const userFolderName = `${userName}_${currentUserId}`;

        const folderPath = `chat-messages/${conversationId}/${userFolderName}`;

        const result = await uploadToCloudinary(file, folderPath);

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: result.url,
                publicId: result.publicId,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Keep uploadChatImage as alias for backward compatibility
export const uploadChatImage = uploadChatFile;

// Send a message
export const sendMessage = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id: conversationId} = req.params;
        const {content, attachmentUrl, replyTo} = req.body;
        const currentUserId = req.user!._id;

        if (!conversationId || (!content && !attachmentUrl)) {
            const error: CustomError = new Error('Conversation ID and content or attachment are required');
            error.statusCode = 400;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            const error: CustomError = new Error('Invalid conversation ID');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: currentUserId,
            deletedAt: null,
        });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        let messageContent = '';
        if (content && content.trim()) {
            messageContent = content.trim();
        } else if (attachmentUrl) {
            const urlLower = attachmentUrl.toLowerCase();
            if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) || urlLower.includes('/image/')) {
                messageContent = '📷 Image';
            } else if (urlLower.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i) || urlLower.includes('/video/')) {
                messageContent = '🎥 Video';
            } else {
                messageContent = '📎 File';
            }
        }

        if (replyTo) {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                const error: CustomError = new Error('Invalid replyTo message ID');
                error.statusCode = 400;
                throw error;
            }
            const repliedMessage = await Message.findOne({
                _id: replyTo,
                conversation: conversationId,
                deletedAt: null,
            });
            if (!repliedMessage) {
                const error: CustomError = new Error('Replied message not found in this conversation');
                error.statusCode = 404;
                throw error;
            }
        }

        const message = new Message({
            conversation: conversationId,
            sender: currentUserId,
            content: messageContent,
            attachmentUrl: attachmentUrl || null,
            replyTo: replyTo || null,
            readBy: [currentUserId],
        });

        await message.save();

        conversation.lastMessage = message._id as mongoose.Types.ObjectId;
        conversation.lastMessageAt = new Date();

        conversation.participants.forEach((participantId) => {
            if (participantId.toString() !== currentUserId) {
                const currentUnread = conversation.unreadCounts.get(participantId.toString()) || 0;
                conversation.unreadCounts.set(participantId.toString(), currentUnread + 1);
            }
        });

        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'firstName lastName email role profilePhoto')
            .populate('readBy', 'firstName lastName')
            .populate({
                path: 'replyTo',
                select: 'content sender attachmentUrl createdAt',
                populate: {
                    path: 'sender',
                    select: 'firstName lastName profilePhoto',
                },
            });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: populatedMessage,
        });
    } catch (error) {
        next(error);
    }
};

// Mark messages as read
export const markMessagesAsRead = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {conversationId} = req.body;
        const currentUserId = req.user!._id;

        if (!conversationId) {
            const error: CustomError = new Error('Conversation ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            const error: CustomError = new Error('Invalid conversation ID');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: currentUserId,
            deletedAt: null,
        });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        const currentUserIdStr = currentUserId.toString();

        const result = await Message.updateMany(
            {
                conversation: new mongoose.Types.ObjectId(conversationId),
                sender: {$ne: currentUserId},
                readBy: {$ne: currentUserId},
                deletedAt: null,
            },
            {
                $addToSet: {readBy: currentUserId},
                $set: {
                    readAt: new Date(),
                    updatedAt: new Date(),
                },
            }
        );

        conversation.unreadCounts.set(currentUserIdStr, 0);
        await conversation.save();

        res.status(200).json({
            success: true,
            message: 'Messages have been marked as read',
            data: {
                messagesUpdated: result.modifiedCount,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete a message
export const deleteMessage = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid message ID');
            error.statusCode = 400;
            throw error;
        }

        const message = await Message.findOne({
            _id: id,
            sender: currentUserId,
            deletedAt: null,
        });

        if (!message) {
            const error: CustomError = new Error('Message not found or you do not have permission to delete it');
            error.statusCode = 404;
            throw error;
        }

        message.deletedAt = new Date();
        await message.save();

        res.status(200).json({
            success: true,
            message: 'Message has been deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Delete a conversation
export const deleteConversation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const currentUserId = req.user!._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid conversation ID');
            error.statusCode = 400;
            throw error;
        }

        const conversation = await Conversation.findOne({
            _id: id,
            participants: currentUserId,
            deletedAt: null,
        });

        if (!conversation) {
            const error: CustomError = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        conversation.deletedAt = new Date();
        await conversation.save();

        res.status(200).json({
            success: true,
            message: 'Conversation has been deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

