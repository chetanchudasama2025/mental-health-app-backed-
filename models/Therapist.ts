import mongoose, { Schema, Document } from "mongoose";

export interface IEducation {
  school: string;
  degree: string;
  startYear?: number;
  endYear?: number;
  degreePhoto?: string;
}

export interface ICertification {
  name: string;
  licenseNumber?: string;
  year?: number;
  certificatePhoto?: string;
}

export interface IExperience {
  position: string;
  organization?: string;
  startYear?: number;
  endYear?: number;
  currentlyWorking?: boolean;
  experiencePhoto?: string;
}

export interface ITherapist extends Document {
  user: mongoose.Types.ObjectId;
  profilePhoto?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  emailVerified: boolean;
  phone?: {
    countryCode: string;
    number: string;
    verified: boolean;
  };
  timezone: string;
  dateOfBirth?: Date;
  gender?: string;
  city?: string;
  country?: string;
  bio?: string;
  videoIntro?: string;
  education: IEducation[];
  certifications: ICertification[];
  experience: IExperience[];
  specializations: string[];
  languages: string[];
  isVerified: boolean;
  deletedAt?: Date | null;
}

const EducationSchema = new Schema<IEducation>({
  school: { type: String, required: true },
  degree: { type: String, required: true },
  startYear: Number,
  endYear: Number,
  degreePhoto: String
});

const CertificationSchema = new Schema<ICertification>({
  name: { type: String, required: true },
  licenseNumber: String,
  year: Number,
  certificatePhoto: String
});

const ExperienceSchema = new Schema<IExperience>({
  position: { type: String, required: true },
  organization: String,
  startYear: Number,
  endYear: Number,
  currentlyWorking: { type: Boolean, default: false },
  experiencePhoto: String
});

const TherapistSchema = new Schema<ITherapist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    profilePhoto: String,
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    preferredName: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: {
      type: Boolean,
      default: false,
    },
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
    isVerified: { type: Boolean, default: false },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ITherapist>("Therapist", TherapistSchema);

