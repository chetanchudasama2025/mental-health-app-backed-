/// <reference types="express" />

import {Request} from 'express';
import mongoose from 'mongoose';

declare global {
    namespace Express {
        interface Request {
            user?: {
                _id: string;
                email: string;
                firstName: string;
                lastName: string;
                role: "admin" | "therapist" | "patient" | "superAdmin" | "therapistManager" | "supportAgent" | "contentModerator";
                therapist: mongoose.Types.ObjectId | null | undefined;
            };
        }
    }
}

export {};

