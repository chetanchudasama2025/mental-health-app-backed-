import mongoose, {Document, Schema} from "mongoose";

export interface IDayAvailability {
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
}

export interface IAvailability extends Document {
    therapistId: mongoose.Types.ObjectId;
    timeZone: string;
    bufferTime: string;
    price: number;
    sessionDuration: string;
    serviceEnabled: boolean;
    availabilityCalendar: IDayAvailability[];
    createdAt: Date;
    updatedAt: Date;
}

const DayAvailabilitySchema = new Schema<IDayAvailability>(
    {
        day: {
            type: String,
            enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            required: true,
        },
        isAvailable: { type: Boolean, default: false },
        startTime: { type: String },
        endTime: { type: String },
    },
    { _id: false }
);

const AvailabilitySchema = new Schema<IAvailability>(
    {
        therapistId: { type: Schema.Types.ObjectId, ref: "Therapist", required: true },
        timeZone: { type: String, required: true },
        bufferTime: { type: String, required: true },
        price: { type: Number, required: true },
        sessionDuration: { type: String, required: true },
        serviceEnabled: { type: Boolean, default: false },
        availabilityCalendar: {
            type: [DayAvailabilitySchema],
            default: [],
        },
    },
    { timestamps: true }
);

export default mongoose.model<IAvailability>("Availability", AvailabilitySchema);

