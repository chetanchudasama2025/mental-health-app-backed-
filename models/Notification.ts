import { Schema, model, Document, Types } from "mongoose";

export interface INotification extends Document {
    user: Types.ObjectId;
    title: string;
    message: string;
    type: "session_booked" | "payment" | "message" | "system" | "custom";
    icon?: string;
    metadata?: Record<string, any>;
    isRead: boolean;
    readAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ["session_booked", "payment", "message", "system", "custom"],
            default: "custom",
        },
        icon: { type: String, default: null },
        metadata: { type: Schema.Types.Mixed, default: {} },
        isRead: { type: Boolean, default: false },
        readAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default model<INotification>("Notification", NotificationSchema);

