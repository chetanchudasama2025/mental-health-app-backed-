import { Schema, model, Document } from "mongoose";

export interface IEmailVerificationToken extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  deletedAt?: Date | null;
  createdAt: Date;
}

const EmailVerificationTokenSchema = new Schema<IEmailVerificationToken>(
  {
    email: {
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
      default: () => new Date(Date.now() + 10 * 60 * 1000),
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
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

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken = model<IEmailVerificationToken>(
  "EmailVerificationToken",
  EmailVerificationTokenSchema
);

