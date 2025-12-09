import mongoose, {Document, Schema} from "mongoose";

export interface ITherapistReview extends Document {
    therapist: mongoose.Types.ObjectId;
    reviewer: mongoose.Types.ObjectId;
    rating: number;
    review: string;
    isAnonymous: boolean;
    sessionId: mongoose.Types.ObjectId;
    status: "pending" | "approved" | "rejected";
    remarks?: string | null;
    attachments?: string[];
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const TherapistReviewSchema = new Schema<ITherapistReview>(
    {
        therapist: {
            type: Schema.Types.ObjectId,
            ref: "Therapist",
            required: true,
        },
        reviewer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true,
        },
        review: {
            type: String,
            required: true,
            trim: true,
            minlength: 10,
            maxlength: 2000,
        },
        isAnonymous: {
            type: Boolean,
            default: false,
        },
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        remarks: {
            type: String,
            default: null,
            trim: true,
        },
        attachments: {
            type: [String],
            default: [],
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {timestamps: true}
);

export const TherapistReview = mongoose.model<ITherapistReview>(
    "TherapistReview",
    TherapistReviewSchema
);
