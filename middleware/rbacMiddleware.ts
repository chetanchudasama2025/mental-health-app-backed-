import {NextFunction, Response} from 'express';
import {AuthRequest} from './authMiddleware';
import {CustomError} from './errorHandler';
import {Actions, Subjects} from '../config/abilities';
import {IUser} from "../models/User";

/**
 * RBAC Middleware to check if user has permission to perform an action on a subject
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
 * Middleware to check if user has specific allowed roles.
 * Now synced CORRECTLY with your User model
 */
export const requireRole = (...roles: Array<IUser["role"]>) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        const error: CustomError = new Error('User not authenticated');
        error.statusCode = 401;
        throw error;
      }

      if (!roles.includes(req.user.role)) {
        const error: CustomError = new Error(
          `Access denied. Required role: ${roles.join(' or ')}`
        );
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
 * Middleware to check ownership or admin/superAdmin access
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

      if (req.user.role === 'admin' || req.user.role === 'superAdmin') {
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