import mongoose, {Document, model, Schema} from "mongoose";

export interface ISupportTicket extends Document {
    userId?: mongoose.Types.ObjectId;
    email: string;
    phone?: string;
    userType: "patient" | "therapist";
    ticketNumber: string;
    issueCategory:
        | "billing_refunds"
        | "technical_support"
        | "session_support"
        | "account_issues"
        | "platform_features"
        | "therapist_concerns"
        | "general_inquiry";
    subject: string;
    description: string;
    priority: "low" | "medium" | "high";
    attachmentUrls?: string[];
    status: "open" | "in_progress" | "resolved" | "closed";
    deletedAt?: Date | null;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        ticketNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            default: null,
        },
        userType: {
            type: String,
            enum: ["patient", "therapist"],
            required: true,
        },
        issueCategory: {
            type: String,
            enum: [
                "billing_refunds",
                "technical_support",
                "session_support",
                "account_issues",
                "platform_features",
                "therapist_concerns",
                "general_inquiry",
            ],
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "low",
        },
        attachmentUrls: {
            type: [String],
            default: [],
        },
        status: {
            type: String,
            enum: ["open", "in_progress", "resolved", "closed"],
            default: "open",
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {timestamps: true}
);

export const SupportTicket = model<ISupportTicket>(
    "SupportTicket",
    SupportTicketSchema
);

