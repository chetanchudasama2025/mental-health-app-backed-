import {Document, model, Schema} from "mongoose";

export interface IPhoneVerificationToken extends Document {
    phone: string;
    otp: string;
    expiresAt: Date;
    attemptsToday: number;
    lastAttemptDate: Date | null;
    deletedAt?: Date | null;
    createdAt: Date;
}

const PhoneVerificationTokenSchema = new Schema<IPhoneVerificationToken>(
    {
        phone: {
            type: String,
            required: true,
        },
        otp: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 5 * 60 * 1000),
        },
        attemptsToday: {
            type: Number,
            default: 0,
        },
        lastAttemptDate: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

PhoneVerificationTokenSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const PhoneVerificationToken = model<IPhoneVerificationToken>(
    "PhoneVerificationToken",
    PhoneVerificationTokenSchema
);
