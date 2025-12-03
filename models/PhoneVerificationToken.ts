import { Schema, model, Document } from "mongoose";

export interface IPhoneVerificationToken extends Document {
  phone: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
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

PhoneVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PhoneVerificationToken = model<IPhoneVerificationToken>(
  "PhoneVerificationToken",
  PhoneVerificationTokenSchema
);

