import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { CustomError } from './errorHandler';
import { Actions, Subjects } from '../config/abilities';

/**
 * RBAC Middleware to check if user has permission to perform an action on a subject
 * @param action - The action to check (create, read, update, delete, manage)
 * @param subject - The subject/resource to check (User, Therapist, Booking, etc.)
 * @returns Express middleware function
 */
export const checkPermission = (action: Actions, subject: Subjects) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.ability) {
        const error: CustomError = new Error('Abilities not defined. Ensure authenticate middleware is called first.');
        error.statusCode = 500;
        throw error;
      }

      if (!req.user) {
        const error: CustomError = new Error('User not authenticated');
        error.statusCode = 401;
        throw error;
      }

      if (!req.ability.can(action, subject)) {
        const error: CustomError = new Error(`You don't have permission to ${action} ${subject}`);
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user has a specific role
 * @param roles - Array of allowed roles
 * @returns Express middleware function
 */
export const requireRole = (...roles: Array<'admin' | 'therapist' | 'patient'>) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        const error: CustomError = new Error('User not authenticated');
        error.statusCode = 401;
        throw error;
      }

      if (!roles.includes(req.user.role)) {
        const error: CustomError = new Error(`Access denied. Required role: ${roles.join(' or ')}`);
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user owns the resource or is admin
 * This is a helper for checking resource ownership
 * @param getResourceOwnerId - Function to extract owner ID from request
 * @returns Express middleware function
 */
export const requireOwnershipOrAdmin = (
  getResourceOwnerId: (req: AuthRequest) => string | null
) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        const error: CustomError = new Error('User not authenticated');
        error.statusCode = 401;
        throw error;
      }

      if (req.user.role === 'admin') {
        return next();
      }

      const resourceOwnerId = getResourceOwnerId(req);
      if (!resourceOwnerId) {
        const error: CustomError = new Error('Resource owner not found');
        error.statusCode = 404;
        throw error;
      }

      if (resourceOwnerId !== req.user._id) {
        const error: CustomError = new Error('You can only access your own resources');
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

