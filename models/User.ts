import { Schema, model, Document } from "mongoose";
import mongoose from "mongoose";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: {
    countryCode: string;
    number: string;
    verified: boolean;
  };
  emailVerified: boolean;
  dateOfBirth: Date;
  gender: "male" | "female" | "other";
  country: string;
  timezone: string;
  password: string;
  role: "admin" | "therapist" | "patient";
  therapist?: mongoose.Types.ObjectId;
  tokenVersion: number;
  isRemember: boolean;
  deletedAt?: Date | null;
  accountDeletionReason?: string | null;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: { type: String, default: null },
    phone: {
      countryCode: {
        type: String,
      },
      number: {
        type: String,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    country: {
      type: String,
    },
    timezone: {
      type: String,
    },
    password: {
      type: String,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "therapist", "patient"],
      default: "patient",
      required: true,
    },
    therapist: {
      type: Schema.Types.ObjectId,
      ref: "Therapist",
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    isRemember: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    accountDeletionReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ therapist: 1 });

export const User = model<IUser>("User", UserSchema);

