import {NextFunction, Request, Response} from "express";
import mongoose from "mongoose";
import ContactForm from "../models/ContactUs";
import {CustomError} from "../middleware/errorHandler";

// CREATE
export const createContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {name, email, phone, message, subject} = req.body;

        if (!name || !email || !phone || !message) {
            const error: CustomError = new Error("Name, Email, Phone and Message are required");
            error.statusCode = 400;
            throw error;
        }

        const contact = await ContactForm.create({
            name,
            email,
            phone,
            message,
            subject,
        });

        res.status(201).json({
            success: true,
            message: "Message submitted successfully",
            data: contact,
        });

    } catch (error) {
        next(error);
    }
};

// GET ALL
export const getAllContacts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            page = "1",
            limit = "10",
            status,
            search,
        } = req.query;

        const query: any = {deletedAt: null};

        if (status) query.status = status;

        if (search) {
            query.$or = [
                {name: new RegExp(search as string, "i")},
                {email: new RegExp(search as string, "i")},
                {phone: new RegExp(search as string, "i")},
                {message: new RegExp(search as string, "i")},
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const contacts = await ContactForm.find(query)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({createdAt: -1});

        const total = await ContactForm.countDocuments(query);

        res.status(200).json({
            success: true,
            message: "Contacts retrieved successfully",
            data: contacts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });

    } catch (error) {
        next(error);
    }
};

// GET ONE
export const getContactById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error("Invalid contact ID");
            error.statusCode = 400;
            throw error;
        }

        const contact = await ContactForm.findOne({_id: id, deletedAt: null});

        if (!contact) {
            const error: CustomError = new Error("Message not found");
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: "Contact retrieved successfully",
            data: contact,
        });

    } catch (error) {
        next(error);
    }
};

// UPDATE STATUS
export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;
        const {status} = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error("Invalid contact ID");
            error.statusCode = 400;
            throw error;
        }

        const allowedStatus = ["new", "read", "responded"];
        if (status && !allowedStatus.includes(status)) {
            const error: CustomError = new Error("Invalid status");
            error.statusCode = 400;
            throw error;
        }

        const updated = await ContactForm.findByIdAndUpdate(
            id,
            {status},
            {new: true}
        );

        res.status(200).json({
            success: true,
            message: "Contact updated successfully",
            data: updated,
        });

    } catch (error) {
        next(error);
    }
};

// DELETE (SOFT)
export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error("Invalid contact ID");
            error.statusCode = 400;
            throw error;
        }

        await ContactForm.findByIdAndUpdate(id, {deletedAt: new Date()});

        res.status(200).json({
            success: true,
            message: "Contact deleted successfully",
        });

    } catch (error) {
        next(error);
    }
};
