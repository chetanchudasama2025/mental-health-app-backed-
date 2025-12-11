import mongoose, {Document, Schema} from "mongoose";

export interface IContactForm extends Document {
    name: string;
    email: string;
    phone: string;
    message: string;
    subject?: string;
    status: "new" | "read" | "responded";
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const ContactFormSchema = new Schema<IContactForm>(
    {
        name: {type: String, required: true, trim: true},
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phone: {type: String, required: true, trim: true},
        message: {type: String, required: true, trim: true, maxlength: 2000},
        subject: {type: String, trim: true, maxlength: 150},
        status: {
            type: String,
            enum: ["new", "read", "responded"],
            default: "new",
        },
        deletedAt: {type: Date, default: null},
    },
    {timestamps: true}
);

export default mongoose.model<IContactForm>("ContactForm", ContactFormSchema);
