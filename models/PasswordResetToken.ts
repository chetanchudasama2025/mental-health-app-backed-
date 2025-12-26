import {Document, model, Schema} from "mongoose";

export interface IPasswordResetToken extends Document {
    userId: Schema.Types.ObjectId;
    token: string;
    expiresAt: Date;
    deletedAt?: Date | null;
    createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 10 * 60 * 1000),
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

PasswordResetTokenSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const PasswordResetToken = model<IPasswordResetToken>(
    "PasswordResetToken",
    PasswordResetTokenSchema
);

