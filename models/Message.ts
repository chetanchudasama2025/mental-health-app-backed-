import mongoose, {Document, model, Schema} from "mongoose";

export interface IMessage extends Document {
    conversation: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    content: string;
    attachmentUrl?: string;
    replyTo?: mongoose.Types.ObjectId;
    readBy: mongoose.Types.ObjectId[];
    readAt?: Date;
    deletedAt?: Date | null;
    deletedFor?: mongoose.Types.ObjectId[];
    editedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
    {
        conversation: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        attachmentUrl: {
            type: String,
            default: null,
        },
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        readBy: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        readAt: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedFor: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        editedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

MessageSchema.index({conversation: 1, createdAt: -1});
MessageSchema.index({sender: 1});

export const Message = model<IMessage>("Message", MessageSchema);

