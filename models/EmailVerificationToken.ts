import {Document, model, Schema} from "mongoose";

export interface IEmailVerificationToken extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  attemptsToday: number;
  lastAttemptDate: Date | null;
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

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken = model<IEmailVerificationToken>(
  "EmailVerificationToken",
  EmailVerificationTokenSchema
);
