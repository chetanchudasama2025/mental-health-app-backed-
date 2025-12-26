import {NextFunction, Request, Response} from "express";
import {AppConfig} from "../models/AppConfig";
import {CustomError} from "../middleware/errorHandler";

// GET - Get the active app configuration
export const getAppConfig = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const config = await AppConfig.findOne({isActive: true});

        if (!config) {
            res.status(200).json({
                success: true,
                message: "App configuration retrieved successfully",
                data: {
                    specializations: [],
                    languages: [],
                    isActive: true,
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "App configuration retrieved successfully",
            data: config,
        });
    } catch (error) {
        next(error);
    }
};

// GET ALL - Get all configurations (including inactive)
export const getAllAppConfigs = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const configs = await AppConfig.find().sort({createdAt: -1});

        res.status(200).json({
            success: true,
            message: "App configurations retrieved successfully",
            data: configs,
        });
    } catch (error) {
        next(error);
    }
};

// CREATE - Create/Initialize app configuration
export const createAppConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {specializations, languages, isActive} = req.body;

        const existingConfig = await AppConfig.findOne();

        if (existingConfig) {
            const error: CustomError = new Error(
                "App configuration already exists. Use update endpoint to modify it."
            );
            error.statusCode = 409;
            throw error;
        }

        if (specializations && !Array.isArray(specializations)) {
            const error: CustomError = new Error(
                "Specializations must be an array"
            );
            error.statusCode = 400;
            throw error;
        }

        if (languages && !Array.isArray(languages)) {
            const error: CustomError = new Error("Languages must be an array");
            error.statusCode = 400;
            throw error;
        }

        if (isActive === true) {
            await AppConfig.updateMany({isActive: true}, {isActive: false});
        }

        const config = await AppConfig.create({
            specializations: specializations || [],
            languages: languages || [],
            isActive: isActive !== undefined ? isActive : true,
        });

        res.status(201).json({
            success: true,
            message: "App configuration created successfully",
            data: config,
        });
    } catch (error) {
        next(error);
    }
};

// UPDATE - Update app configuration
export const updateAppConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {specializations, languages, isActive} = req.body;

        const config = await AppConfig.findById(id);

        if (!config) {
            const error: CustomError = new Error("App configuration not found");
            error.statusCode = 404;
            throw error;
        }

        if (specializations !== undefined && !Array.isArray(specializations)) {
            const error: CustomError = new Error(
                "Specializations must be an array"
            );
            error.statusCode = 400;
            throw error;
        }

        if (languages !== undefined && !Array.isArray(languages)) {
            const error: CustomError = new Error("Languages must be an array");
            error.statusCode = 400;
            throw error;
        }

        if (isActive === true && !config.isActive) {
            await AppConfig.updateMany(
                {_id: {$ne: id}, isActive: true},
                {isActive: false}
            );
        }

        if (specializations !== undefined) {
            config.specializations = specializations;
        }
        if (languages !== undefined) {
            config.languages = languages;
        }
        if (isActive !== undefined) {
            config.isActive = isActive;
        }

        await config.save();

        res.status(200).json({
            success: true,
            message: "App configuration updated successfully",
            data: config,
        });
    } catch (error) {
        next(error);
    }
};

// DELETE - Delete app configuration
export const deleteAppConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        const config = await AppConfig.findById(id);

        if (!config) {
            const error: CustomError = new Error("App configuration not found");
            error.statusCode = 404;
            throw error;
        }

        await AppConfig.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "App configuration deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};


