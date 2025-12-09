import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import Notification, {INotification} from '../models/Notification';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';
import {User} from '../models/User';

// Create a new notification
export const createNotification = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, title, message, type, icon, metadata } = req.body;

    const targetUserId = (req as AuthRequest).user?._id || userId;

    if (!targetUserId || !title || !message) {
      const error: CustomError = new Error('User ID, title, and message are required');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      const error: CustomError = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const validTypes = ['session_booked', 'payment', 'message', 'system', 'custom'];
    if (type && !validTypes.includes(type)) {
      const error: CustomError = new Error('Invalid notification type');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!user) {
      const error: CustomError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const notification = new Notification({
      user: new mongoose.Types.ObjectId(targetUserId),
      title: title.trim(),
      message: message.trim(),
      type: type || 'custom',
      icon: icon || null,
      metadata: metadata || {},
      isRead: false,
      readAt: null,
    });

    await notification.save();
    await notification.populate('user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// Get all notifications for the authenticated user
export const getAllNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    const {
      page = '1',
      limit = '20',
      isRead,
      type,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = { user: userId };

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (type) {
      const validTypes = ['session_booked', 'payment', 'message', 'system', 'custom'];
      if (!validTypes.includes(type as string)) {
        const error: CustomError = new Error('Invalid notification type filter');
        error.statusCode = 400;
        throw error;
      }
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .populate('user', 'firstName lastName email')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get a single notification by ID
export const getNotificationById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid notification ID');
      error.statusCode = 400;
      throw error;
    }

    const notification = await Notification.findOne({ _id: id, user: userId })
      .populate('user', 'firstName lastName email');

    if (!notification) {
      const error: CustomError = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Notification information retrieved successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// Update notification (mark as read/unread, update fields)
export const updateNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const { title, message, type, icon, metadata, isRead } = req.body;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid notification ID');
      error.statusCode = 400;
      throw error;
    }

    const notification = await Notification.findOne({ _id: id, user: userId });
    if (!notification) {
      const error: CustomError = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    const updateData: Partial<INotification> = {};

    if (title !== undefined) {
      updateData.title = title.trim();
    }

    if (message !== undefined) {
      updateData.message = message.trim();
    }

    if (type !== undefined) {
      const validTypes = ['session_booked', 'payment', 'message', 'system', 'custom'];
      if (!validTypes.includes(type)) {
        const error: CustomError = new Error('Invalid notification type');
        error.statusCode = 400;
        throw error;
      }
      updateData.type = type;
    }

    if (icon !== undefined) {
      updateData.icon = icon || null;
    }

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    if (isRead !== undefined) {
      updateData.isRead = isRead;
      if (isRead && !notification.isRead) {
        updateData.readAt = new Date();
      } else if (!isRead) {
        updateData.readAt = null;
      }
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName email');

    if (!updatedNotification) {
      const error: CustomError = new Error('Failed to update notification. Please try again.');
      error.statusCode = 500;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Notification information updated successfully',
      data: updatedNotification,
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid notification ID');
      error.statusCode = 400;
      throw error;
    }

    const notification = await Notification.findOne({ _id: id, user: userId });
    if (!notification) {
      const error: CustomError = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    await notification.populate('user', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Notification has been marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read for the authenticated user
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications have been marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification
export const deleteNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: CustomError = new Error('Invalid notification ID');
      error.statusCode = 400;
      throw error;
    }

    const notification = await Notification.findOne({ _id: id, user: userId });
    if (!notification) {
      const error: CustomError = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Notification has been deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.status(200).json({
      success: true,
      message: 'Unread notification count retrieved successfully',
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

