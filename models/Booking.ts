import mongoose, {Document, Schema} from "mongoose";

export interface IBooking extends Document {
    therapist: mongoose.Types.ObjectId;
    patient: mongoose.Types.ObjectId;
    date: Date;
    time: string;
    duration: number;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
    payment: mongoose.Types.ObjectId;
    notes?: string;
    cancelledAt?: Date;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
    {
        therapist: {
            type: Schema.Types.ObjectId,
            ref: "Therapist",
            required: true,
        },
        patient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
            enum: [30, 45, 60],
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
            default: "pending",
        },
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
        },
        notes: {
            type: String,
        },
        cancelledAt: Date,
        cancellationReason: String,
    },
    { timestamps: true }
);

BookingSchema.index({ patient: 1, date: 1 });
BookingSchema.index({ status: 1 });

BookingSchema.index(
    { therapist: 1, date: 1, time: 1 },
    {
        partialFilterExpression: {
            status: { $in: ["pending", "confirmed"] },
        },
    }
);

export default mongoose.model<IBooking>("Booking", BookingSchema);