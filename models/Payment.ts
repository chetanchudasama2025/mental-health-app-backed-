import mongoose, {Document, model, Schema} from "mongoose";

export interface IPayment extends Document {
    user: mongoose.Types.ObjectId;
    amount: number;
    currency: string;
    paymentIntentId: string;
    clientSecret: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    receiptUrl?: string;
    paymentMethod?: string;
    cardHolderName?: string;
    description?: string;
    metadata?: any;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        cardHolderName: {
            type: String,
            default: null,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "usd",
        },
        paymentIntentId: {
            type: String,
            required: true,
            trim: true,
        },
        clientSecret: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "succeeded", "failed", "refunded"],
            default: "pending",
        },
        receiptUrl: {
            type: String,
            default: null,
        },
        paymentMethod: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            trim: true,
            default: null,
        },
        metadata: {
            type: Object,
            default: {},
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

export const Payment = model<IPayment>("Payment", PaymentSchema);
