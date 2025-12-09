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
    const { participantId } = req.body;
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
      participants: { $all: [currentUserId, participantId] },
      deletedAt: null,
    })
      .populate('participants', 'firstName lastName email role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

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
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const conversations = await Conversation.find({
      participants: currentUserId,
      deletedAt: null,
    })
      .populate('participants', 'firstName lastName email role')
      .populate({
        path: 'lastMessage',
        select: 'content sender createdAt',
        populate: {
          path: 'sender',
          select: 'firstName lastName',
        },
      })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
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
    const { id } = req.params;
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
      .populate('participants', 'firstName lastName email role')
      .populate('lastMessage');

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
    const { id } = req.params;
    const currentUserId = req.user!._id;
    const { page = 1, limit = 50 } = req.query;

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
      .populate('sender', 'firstName lastName email role')
      .sort({ createdAt: -1 })
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

// Send a message
export const sendMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: conversationId } = req.params;
    const { content, attachmentUrl } = req.body;
    const currentUserId = req.user!._id;

    if (!conversationId || !content) {
      const error: CustomError = new Error('Conversation ID and content are required');
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

    const message = new Message({
      conversation: conversationId,
      sender: currentUserId,
      content: content.trim(),
      attachmentUrl: attachmentUrl || null,
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
      .populate('sender', 'firstName lastName email role');

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
    const { conversationId } = req.body;
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

    const result = await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
        deletedAt: null,
      },
      {
        $addToSet: { readBy: currentUserId },
        $set: { readAt: new Date() },
      }
    );

    conversation.unreadCounts.set(currentUserId, 0);
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
    const { id } = req.params;
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
    const { id } = req.params;
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

