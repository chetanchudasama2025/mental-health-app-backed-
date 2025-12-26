import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {IUser, User} from '../models/User';
import {CustomError} from './errorHandler';
import mongoose from 'mongoose';
import {AppAbility, defineAbilitiesFor} from '../config/abilities';

export interface AuthRequest extends Request {
    user?: {
        _id: string;
        email: IUser["email"];
        firstName: IUser["firstName"];
        lastName: IUser["lastName"];
        role: IUser["role"];
        therapist: IUser["therapist"];
    };
    ability?: AppAbility;
    body: any;
    query: any;
    params: any;
    headers: any;
    files?: {
        [fieldname: string]: any[] | any;
    };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticate = async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error: CustomError = new Error('No token provided');
            error.statusCode = 401;
            throw error;
        }

        const token = authHeader.substring(7);

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            const error: CustomError = new Error('Invalid or expired token');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const currentTokenVersion = user.tokenVersion || 0;
        const tokenVersion = decoded.tokenVersion ?? 0;
        if (tokenVersion !== currentTokenVersion) {
            const error: CustomError = new Error('Token has been invalidated. Please login again.');
            error.statusCode = 401;
            throw error;
        }

        req.user = {
            _id: (user._id as mongoose.Types.ObjectId).toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            therapist: user.therapist,
        };

        req.ability = defineAbilitiesFor(user as IUser);

        next();
    } catch (error) {
        next(error);
    }
};

