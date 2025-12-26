import {Document, model, Schema} from "mongoose";

export interface IAppConfig extends Document {
    specializations: string[];
    languages: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AppConfigSchema = new Schema<IAppConfig>(
    {
        specializations: {
            type: [String],
            default: [],
            trim: true,
        },
        languages: {
            type: [String],
            default: [],
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

AppConfigSchema.index({}, {unique: true});

export const AppConfig = model<IAppConfig>("AppConfig", AppConfigSchema);
