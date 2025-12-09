import mongoose, {Document, model, Schema} from "mongoose";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  profilePhoto?: string | null;
  role:
  | "admin"
  | "therapist"
  | "patient"
  | "superAdmin"
  | "therapistManager"
  | "supportAgent"
  | "contentModerator";
  therapist?: mongoose.Types.ObjectId | null;
  email: string;
  emailVerified: boolean;
  googleId?: string | null;
  phone: {
    countryCode?: string;
    number?: string;
    verified: boolean;
  };
  password?: string;
  status: "active" | "inactive" | "pending" | "blocked" | "suspended";
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  country?: string;
  timezone?: string;
  privacyPolicyAccepted?: boolean;
  termsOfServiceAccepted?: boolean;
  isRemember: boolean;
  tokenVersion: number;
  refreshToken?: string | null;
  accountDeletionReason?: string | null;
  deletedAt?: Date | null;
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
    profilePhoto: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["admin", "therapist", "patient", "superAdmin", "therapistManager", "supportAgent", "contentModerator"],
      default: "patient",
      required: true,
    },
    therapist: {
      type: Schema.Types.ObjectId,
      ref: "Therapist",
      default: null,
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
    password: {
      type: String,
      minlength: 6,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "blocked", "suspended"],
      default: "active",
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
    privacyPolicyAccepted: {
      type: Boolean,
      default: false,
    },
    termsOfServiceAccepted: {
      type: Boolean,
      default: false,
    },
    isRemember: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    accountDeletionReason: {
      type: String,
      default: null,
      trim: true,
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

UserSchema.index({ therapist: 1 });

export const User = model<IUser>("User", UserSchema);

