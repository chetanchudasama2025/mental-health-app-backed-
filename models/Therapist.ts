import mongoose, { Schema, Document } from "mongoose";

export interface IEducation {
  school: string;
  degree: string;
  startYear?: number;
  endYear?: number;
  degreePhoto?: string;
  status: "valid" | "invalid" | "pending";
}

export interface ICertification {
  name: string;
  licenseNumber?: string;
  year?: number;
  certificatePhoto?: string;
  status: "valid" | "invalid" | "pending";
}

export interface IExperience {
  position: string;
  organization?: string;
  startYear?: number;
  endYear?: number;
  currentlyWorking?: boolean;
  experiencePhoto?: string;
  status: "valid" | "invalid" | "pending";
}

export interface ITherapist extends Document {
  user: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  preferredName?: string;
  profilePhoto?: string;
  email: string;
  emailVerified: boolean;
  phone?: {
    countryCode?: string;
    number?: string;
    verified: boolean;
  };
  status: "approved" | "pending" | "rejected" | "underReview";
  gender?: string;
  dateOfBirth?: Date;
  timezone: string;
  city?: string;
  country?: string;
  bio?: string;
  videoIntro?: string;
  education: IEducation[];
  certifications: ICertification[];
  experience: IExperience[];
  specializations: string[];
  languages: string[];
  reviewNotes?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EducationSchema = new Schema<IEducation>({
  school: { type: String, required: true },
  degree: { type: String, required: true },
  startYear: Number,
  endYear: Number,
  degreePhoto: String,
  status: {
    type: String,
    enum: ["valid", "invalid", "pending"],
    default: "pending",
  },
});

const CertificationSchema = new Schema<ICertification>({
  name: { type: String, required: true },
  licenseNumber: String,
  year: Number,
  certificatePhoto: String,
  status: {
    type: String,
    enum: ["valid", "invalid", "pending"],
    default: "pending",
  },
});

const ExperienceSchema = new Schema<IExperience>({
  position: { type: String, required: true },
  organization: String,
  startYear: Number,
  endYear: Number,
  currentlyWorking: { type: Boolean, default: false },
  experiencePhoto: String,
  status: {
    type: String,
    enum: ["valid", "invalid", "pending"],
    default: "pending",
  },
});

const TherapistSchema = new Schema<ITherapist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    preferredName: String,
    profilePhoto: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: { type: Boolean, default: false },
    phone: {
      countryCode: String,
      number: String,
      verified: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ["approved", "pending", "rejected", "underReview"],
      default: "pending",
    },
    dateOfBirth: Date,
    gender: String,
    city: String,
    country: String,
    timezone: String,
    bio: { type: String, maxlength: 2000 },
    videoIntro: String,
    education: { type: [EducationSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },
    experience: { type: [ExperienceSchema], default: [] },
    specializations: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    reviewNotes: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<ITherapist>("Therapist", TherapistSchema);