import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import {User} from '../models/User';
import {Payment} from '../models/Payment';
import Booking from '../models/Booking';
import Therapist from '../models/Therapist';
import Availability from '../models/Availability';
import Stripe from 'stripe';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Process payment and create booking
export const processPaymentAndCreateBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    try {
        const {
            amount,
            patientId,
            therapistId,
            date,
            time,
            duration,
            paymentMethodId,
        } = req.body;

        if (!amount || amount <= 0)
            return res.status(400).json({success: false, message: "Amount is required"});

        if (!patientId)
            return res.status(400).json({success: false, message: "patientId required"});

        if (!therapistId)
            return res.status(400).json({success: false, message: "therapistId required"});

        if (!paymentMethodId)
            return res.status(400).json({success: false, message: "paymentMethodId required"});

        if (!date || !time || !duration)
            return res.status(400).json({success: false, message: "Booking details missing"});

        const patient = await User.findById(patientId);
        if (!patient)
            return res.status(404).json({success: false, message: "Patient not found"});

        const bookingDate = new Date(date);
        const [H, M] = time.split(":");
        const requestedStart = Number(H) * 60 + Number(M);
        const requestedEnd = requestedStart + Number(duration);

        const availability = await Availability.findOne({therapistId}).lean();
        const bufferMinutes = availability?.bufferTime
            ? parseInt(availability.bufferTime)
            : 15;


        const existingBookings = await Booking.find({
            therapist: therapistId,
            date: bookingDate,
            status: {$in: ["pending", "confirmed", "rescheduled"]},
        }).lean();

        for (const b of existingBookings) {
            const [bh, bm] = b.time.split(":");
            const existingStart = Number(bh) * 60 + Number(bm);
            const existingEnd = existingStart + b.duration;

            const existingEndWithBuffer = existingEnd + bufferMinutes;

            const isConflict =
                existingStart < requestedEnd &&
                existingEndWithBuffer > requestedStart;

            if (isConflict) {
                return res.status(400).json({
                    success: false,
                    message: `This slot is unavailable. Therapist has a session ending at ${b.time} and requires a ${bufferMinutes} min buffer.`,
                });
            }
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: "usd",
            automatic_payment_methods: {enabled: true, allow_redirects: "never"},
            payment_method: paymentMethodId,
            confirm: true,
            metadata: {patientId, therapistId},
        });

        const finalStatus =
            paymentIntent.status === "succeeded" ? "succeeded" : "failed";

        let receiptUrl = null;
        let paymentMethod = null;
        let cardHolderName = null;

        if (paymentIntent.latest_charge) {
            const charge = await stripe.charges.retrieve(
                paymentIntent.latest_charge as string
            );
            receiptUrl = charge.receipt_url ?? null;
            paymentMethod = charge.payment_method_details?.type ?? null;

            if (charge.billing_details?.name) {
                cardHolderName = charge.billing_details.name;
            }

            if (!cardHolderName && paymentIntent.payment_method && typeof paymentIntent.payment_method === 'string') {
                try {
                    const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
                    if (pm.billing_details?.name) {
                        cardHolderName = pm.billing_details.name;
                    }
                } catch (pmError) {
                    console.warn('Failed to retrieve payment method details:', pmError);
                }
            }
        }

        const payment = await Payment.create({
            user: patientId,
            amount,
            currency: "usd",
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            status: finalStatus,
            receiptUrl,
            paymentMethod,
            cardHolderName,
            metadata: {patientId, therapistId},
        });

        if (finalStatus !== "succeeded") {
            return res.status(400).json({
                success: false,
                message: "Payment failed",
                payment,
            });
        }

        const booking = await Booking.create({
            patient: patientId,
            therapist: therapistId,
            date,
            time,
            duration,
            payment: payment._id,
            status: "confirmed",
        });

        return res.status(200).json({
            success: true,
            message: "Payment successful & booking created",
            booking,
            payment,
            stripePayment: paymentIntent,
        });
    } catch (error) {
        next(error);
    }
};

// Create a new booking
export const createBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {therapistId, date, time, duration, payment, notes} = req.body;

        if (!therapistId || !date || !time || !duration) {
            const error: CustomError = new Error('Therapist ID, date, time, and duration are required');
            error.statusCode = 400;
            throw error;
        }

        if (![30, 45, 60].includes(duration)) {
            const error: CustomError = new Error('Session duration must be 30, 45, or 60 minutes');
            error.statusCode = 400;
            throw error;
        }

        if (!payment || !payment.amount || !payment.paymentIntentId || !payment.clientSecret) {
            const error: CustomError = new Error('Payment information is required. Please provide amount, paymentIntentId, and clientSecret');
            error.statusCode = 400;
            throw error;
        }

        const patientId = req.user?._id;
        if (!patientId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: therapistId, deletedAt: null});
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const patient = await User.findOne({_id: patientId, deletedAt: null});
        if (!patient) {
            const error: CustomError = new Error('Patient not found');
            error.statusCode = 404;
            throw error;
        }

        if (therapist.user.toString() === patientId) {
            const error: CustomError = new Error('You cannot book a session with yourself');
            error.statusCode = 400;
            throw error;
        }

        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime())) {
            const error: CustomError = new Error('Invalid date format');
            error.statusCode = 400;
            throw error;
        }

        const normalizedDate = new Date(bookingDate);
        normalizedDate.setHours(0, 0, 0, 0);

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (normalizedDate < now) {
            const error: CustomError = new Error('You cannot book a session for a past date');
            error.statusCode = 400;
            throw error;
        }

        const startOfDay = new Date(normalizedDate);
        const endOfDay = new Date(normalizedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBooking = await Booking.findOne({
            therapist: therapistId,
            date: {
                $gte: startOfDay,
                $lte: endOfDay,
            },
            time: time,
            status: {$in: ['pending', 'confirmed', 'rescheduled']},
        });

        if (existingBooking) {
            const error: CustomError = new Error('This time slot is already booked. Please select another time.');
            error.statusCode = 409;
            throw error;
        }

        let paymentAmount = payment.amount;
        if (!paymentAmount) {
            const pricing: { [key: number]: number } = {
                30: 20,
                45: 35,
                60: 55,
            };
            paymentAmount = pricing[duration] || 20;
        }

        const paymentDoc = new Payment({
            user: patientId,
            amount: paymentAmount,
            currency: payment.currency || 'usd',
            paymentIntentId: payment.paymentIntentId,
            clientSecret: payment.clientSecret,
            status: payment.status || 'succeeded',
            receiptUrl: payment.receiptUrl || null,
            paymentMethod: payment.paymentMethod || null,
            cardHolderName: payment.cardHolderName || null,
            description: payment.description || `Booking for ${duration} minutes session`,
            metadata: payment.metadata || {},
        });

        await paymentDoc.save();

        const booking = new Booking({
            therapist: therapistId,
            patient: patientId,
            date: normalizedDate,
            time: time,
            duration: duration,
            payment: paymentDoc._id,
            notes: notes,
            status: 'confirmed',
        });

        await booking.save();

        await booking.populate('therapist', 'firstName lastName email profilePhotoUrl');
        await booking.populate('patient', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Session booking created successfully',
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// Get all bookings with filters
export const getAllBookings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            therapistId,
            patientId,
            status,
            date,
            page = '1',
            limit = '10',
        } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {};

        if (therapistId) {
            if (!mongoose.Types.ObjectId.isValid(therapistId as string)) {
                const error: CustomError = new Error('Invalid therapist ID');
                error.statusCode = 400;
                throw error;
            }
            filter.therapist = therapistId;
        }

        if (patientId) {
            if (!mongoose.Types.ObjectId.isValid(patientId as string)) {
                const error: CustomError = new Error('Invalid patient ID');
                error.statusCode = 400;
                throw error;
            }
            filter.patient = patientId;
        }

        if (status) {
            filter.status = status;
        }

        if (date) {
            const filterDate = new Date(date as string);
            if (!isNaN(filterDate.getTime())) {
                filterDate.setHours(0, 0, 0, 0);
                const nextDay = new Date(filterDate);
                nextDay.setDate(nextDay.getDate() + 1);
                filter.date = {
                    $gte: filterDate,
                    $lt: nextDay,
                };
            }
        }

        const bookings = await Booking.find(filter)
            .populate('therapist', 'firstName lastName email profilePhotoUrl')
            .populate('patient', 'firstName lastName email')
            .populate('payment')
            .sort({date: -1, time: -1})
            .skip(skip)
            .limit(limitNumber);

        const total = await Booking.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Bookings retrieved successfully',
            data: {
                bookings,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get booking by ID
export const getBookingById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid booking ID');
            error.statusCode = 400;
            throw error;
        }

        const booking = await Booking.findById(id)
            .populate('therapist', 'firstName lastName email profilePhotoUrl bio specializations')
            .populate('patient', 'firstName lastName email')
            .populate('payment');

        if (!booking) {
            const error: CustomError = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Booking information retrieved successfully',
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// Get bookings by therapist
export const getBookingsByTherapist = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {therapistId} = req.params;
        const {status, date, page = '1', limit = '10'} = req.query;

        if (!mongoose.Types.ObjectId.isValid(therapistId)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: therapistId, deletedAt: null});
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {therapist: therapistId};

        if (status) {
            filter.status = status;
        }

        if (date) {
            const filterDate = new Date(date as string);
            if (!isNaN(filterDate.getTime())) {
                filterDate.setHours(0, 0, 0, 0);
                const nextDay = new Date(filterDate);
                nextDay.setDate(nextDay.getDate() + 1);
                filter.date = {
                    $gte: filterDate,
                    $lt: nextDay,
                };
            }
        }

        const bookings = await Booking.find(filter)
            .populate('patient', 'firstName lastName email')
            .populate('payment')
            .sort({date: -1, time: -1})
            .skip(skip)
            .limit(limitNumber);

        const total = await Booking.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Therapist bookings retrieved successfully',
            data: {
                bookings,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get bookings by patient (current user)
export const getMyBookings = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const patientId = req.user?._id;
        const {status, date, page = '1', limit = '10'} = req.query;

        if (!patientId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {patient: patientId};

        if (status) {
            filter.status = status;
        }

        if (date) {
            const filterDate = new Date(date as string);
            if (!isNaN(filterDate.getTime())) {
                filterDate.setHours(0, 0, 0, 0);
                const nextDay = new Date(filterDate);
                nextDay.setDate(nextDay.getDate() + 1);
                filter.date = {
                    $gte: filterDate,
                    $lt: nextDay,
                };
            }
        }

        const bookings = await Booking.find(filter)
            .populate('therapist', 'firstName lastName email profilePhotoUrl bio specializations')
            .populate('payment')
            .sort({date: -1, time: -1})
            .skip(skip)
            .limit(limitNumber);

        const total = await Booking.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: 'Your bookings retrieved successfully',
            data: {
                bookings,
                pagination: {
                    currentPage: pageNumber,
                    totalPages: Math.ceil(total / limitNumber),
                    totalItems: total,
                    itemsPerPage: limitNumber,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get past therapists for a patient
export const getPastTherapists = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authenticatedUserId = req.user?._id;
        const {patientId: paramPatientId} = req.params;

        const targetPatientId = paramPatientId || authenticatedUserId;

        if (!targetPatientId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(targetPatientId)) {
            const error: CustomError = new Error('Invalid patient ID');
            error.statusCode = 400;
            throw error;
        }

        const patient = await User.findOne({_id: targetPatientId, deletedAt: null});
        if (!patient) {
            const error: CustomError = new Error('Patient not found');
            error.statusCode = 404;
            throw error;
        }

        if (!authenticatedUserId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(authenticatedUserId);
        const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
        const isOwnProfile = authenticatedUserId === targetPatientId;

        if (!isOwnProfile && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to view this patient\'s past therapists');
            error.statusCode = 403;
            throw error;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const pastBookings = await Booking.find({
            patient: targetPatientId,
            $or: [
                {status: {$in: ['completed', 'cancelled', 'no-show']}},
                {
                    $and: [
                        {date: {$lt: now}},
                        {status: {$in: ['pending', 'confirmed', 'rescheduled']}}
                    ]
                }
            ]
        })
            .populate('therapist', 'firstName lastName email profilePhotoUrl bio specializations languages certifications education')
            .sort({date: -1, time: -1})
            .lean();

        const therapistMap = new Map<string, any>();

        pastBookings.forEach((booking: any) => {
            if (!booking.therapist || !booking.therapist._id) return;

            const therapistId = booking.therapist._id.toString();

            if (!therapistMap.has(therapistId)) {
                therapistMap.set(therapistId, {
                    therapist: booking.therapist,
                    lastSessionDate: booking.date,
                    lastSessionTime: booking.time,
                    lastSessionDuration: booking.duration,
                    lastSessionStatus: booking.status,
                    totalSessions: 1,
                });
            } else {
                const existing = therapistMap.get(therapistId);
                const existingDate = new Date(existing.lastSessionDate);
                const currentDate = new Date(booking.date);

                if (currentDate > existingDate ||
                    (currentDate.getTime() === existingDate.getTime() && booking.time > existing.lastSessionTime)) {
                    existing.lastSessionDate = booking.date;
                    existing.lastSessionTime = booking.time;
                    existing.lastSessionDuration = booking.duration;
                    existing.lastSessionStatus = booking.status;
                }
                existing.totalSessions += 1;
            }
        });

        const pastTherapists = Array.from(therapistMap.values()).map((item) => ({
            therapist: item.therapist,
            lastSession: {
                date: item.lastSessionDate,
                time: item.lastSessionTime,
                duration: item.lastSessionDuration,
                status: item.lastSessionStatus,
            },
            totalSessions: item.totalSessions,
        }));

        res.status(200).json({
            success: true,
            message: 'Past therapists retrieved successfully',
            data: {
                patientId: targetPatientId,
                totalTherapists: pastTherapists.length,
                therapists: pastTherapists,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update booking
export const updateBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {date, time, duration, status, notes, cancellationReason} = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid booking ID');
            error.statusCode = 400;
            throw error;
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            const error: CustomError = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(userId);
        const therapist = await Therapist.findById(booking.therapist);
        const isPatient = booking.patient.toString() === userId;
        const isTherapist = therapist?.user.toString() === userId;
        const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';

        if (!isPatient && !isTherapist && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to update this booking');
            error.statusCode = 403;
            throw error;
        }

        if (date) {
            const newDate = new Date(date);
            if (isNaN(newDate.getTime())) {
                const error: CustomError = new Error('Invalid date format');
                error.statusCode = 400;
                throw error;
            }
            const normalizedDate = new Date(newDate);
            normalizedDate.setHours(0, 0, 0, 0);
            booking.date = normalizedDate;
            booking.reminderSent = false;
            booking.reminderSentAt = undefined;
        }

        if (time) {
            booking.time = time;
            booking.reminderSent = false;
            booking.reminderSentAt = undefined;
        }

        if (duration) {
            if (![30, 45, 60].includes(duration)) {
                const error: CustomError = new Error('Session duration must be 30, 45, or 60 minutes');
                error.statusCode = 400;
                throw error;
            }
            booking.duration = duration;
        }

        if (status) {
            if (!['pending', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduled'].includes(status)) {
                const error: CustomError = new Error('Invalid status');
                error.statusCode = 400;
                throw error;
            }

            if (status === 'cancelled' && booking.status !== 'cancelled') {
                booking.cancelledAt = new Date();
                if (cancellationReason) {
                    booking.cancellationReason = cancellationReason;
                }
                if (isPatient) {
                    booking.cancelledBy = 'patient';
                } else if (isTherapist) {
                    booking.cancelledBy = 'therapist';
                } else if (user?.role === 'admin' || user?.role === 'superAdmin') {
                    booking.cancelledBy = 'admin';
                }
            }

            booking.status = status;
        }

        if (notes !== undefined) {
            booking.notes = notes;
        }

        await booking.save();

        await booking.populate('therapist', 'firstName lastName email profilePhotoUrl');
        await booking.populate('patient', 'firstName lastName email');
        await booking.populate('payment');

        res.status(200).json({
            success: true,
            message: 'Booking information updated successfully',
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// Reschedule booking
export const rescheduleBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {date, time, duration} = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid booking ID');
            error.statusCode = 400;
            throw error;
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            const error: CustomError = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const isPatient = booking.patient.toString() === userId;
        if (!isPatient) {
            const error: CustomError = new Error('Only the patient who made the booking can reschedule it');
            error.statusCode = 403;
            throw error;
        }

        if (booking.status === 'cancelled') {
            const error: CustomError = new Error('You cannot reschedule a cancelled booking');
            error.statusCode = 400;
            throw error;
        }

        if (booking.status === 'completed') {
            const error: CustomError = new Error('You cannot reschedule a completed booking');
            error.statusCode = 400;
            throw error;
        }

        if (booking.status === 'no-show') {
            const error: CustomError = new Error('You cannot reschedule a no-show booking');
            error.statusCode = 400;
            throw error;
        }

        const currentBookingDate = new Date(booking.date);
        const [currentHour, currentMinute] = booking.time.split(':');
        currentBookingDate.setHours(parseInt(currentHour), parseInt(currentMinute), 0, 0);

        const now = new Date();
        const timeDifferenceMs = currentBookingDate.getTime() - now.getTime();
        const hoursUntilBooking = timeDifferenceMs / (1000 * 60 * 60);

        if (hoursUntilBooking < 24) {
            const error: CustomError = new Error(
                'You cannot reschedule a booking that is less than 24 hours away. Please contact support if you need to make changes.'
            );
            error.statusCode = 400;
            throw error;
        }

        if (!date || !time) {
            const error: CustomError = new Error('New date and time are required for rescheduling');
            error.statusCode = 400;
            throw error;
        }

        const newBookingDate = new Date(date);
        if (isNaN(newBookingDate.getTime())) {
            const error: CustomError = new Error('Invalid date format');
            error.statusCode = 400;
            throw error;
        }

        const normalizedNewDate = new Date(newBookingDate);
        normalizedNewDate.setHours(0, 0, 0, 0);

        const normalizedNow = new Date(now);
        normalizedNow.setHours(0, 0, 0, 0);
        if (normalizedNewDate < normalizedNow) {
            const error: CustomError = new Error('You cannot reschedule to a past date');
            error.statusCode = 400;
            throw error;
        }

        const newDuration = duration || booking.duration;
        if (![30, 45, 60].includes(newDuration)) {
            const error: CustomError = new Error('Session duration must be 30, 45, or 60 minutes');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findById(booking.therapist);
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const availability = await Availability.findOne({therapistId: booking.therapist}).lean();
        const bufferMinutes = availability?.bufferTime ? parseInt(availability.bufferTime) : 15;

        const [H, M] = time.split(':');
        const requestedStart = Number(H) * 60 + Number(M);
        const requestedEnd = requestedStart + newDuration;

        const existingBookings = await Booking.find({
            therapist: booking.therapist,
            date: normalizedNewDate,
            status: {$in: ['pending', 'confirmed', 'rescheduled']},
            _id: {$ne: booking._id},
        }).lean();

        for (const b of existingBookings) {
            const [bh, bm] = b.time.split(':');
            const existingStart = Number(bh) * 60 + Number(bm);
            const existingEnd = existingStart + b.duration;
            const existingEndWithBuffer = existingEnd + bufferMinutes;

            const isConflict =
                existingStart < requestedEnd && existingEndWithBuffer > requestedStart;

            if (isConflict) {
                const error: CustomError = new Error(
                    `This time slot is unavailable. Therapist has a session ending at ${b.time} and requires a ${bufferMinutes} min buffer.`
                );
                error.statusCode = 409;
                throw error;
            }
        }

        booking.date = normalizedNewDate;
        booking.time = time;
        booking.duration = newDuration;
        booking.status = 'rescheduled';
        booking.reminderSent = false;
        booking.reminderSentAt = undefined;

        await booking.save();

        await booking.populate('therapist', 'firstName lastName email profilePhotoUrl');
        await booking.populate('patient', 'firstName lastName email');
        await booking.populate('payment');

        res.status(200).json({
            success: true,
            message: 'Booking has been rescheduled successfully',
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// Cancel booking
export const cancelBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;
        const {cancellationReason} = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid booking ID');
            error.statusCode = 400;
            throw error;
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            const error: CustomError = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        if (booking.status === 'cancelled') {
            const error: CustomError = new Error('This booking has already been cancelled');
            error.statusCode = 400;
            throw error;
        }

        if (booking.status === 'completed') {
            const error: CustomError = new Error('You cannot cancel a booking that has already been completed');
            error.statusCode = 400;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const user = await User.findById(userId);
        if (!user) {
            const error: CustomError = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const therapist = await Therapist.findById(booking.therapist);
        const isPatient = booking.patient.toString() === userId;
        const isTherapist = therapist?.user.toString() === userId;
        const isAdmin = user.role === 'admin' || user.role === 'superAdmin';

        if (!isPatient && !isTherapist && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to cancel this booking');
            error.statusCode = 403;
            throw error;
        }

        let cancelledBy: 'patient' | 'therapist' | 'admin' = 'patient';
        if (isAdmin) {
            cancelledBy = 'admin';
        } else if (isTherapist) {
            cancelledBy = 'therapist';
        } else if (isPatient) {
            cancelledBy = 'patient';
        }

        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelledBy = cancelledBy;
        if (cancellationReason) {
            booking.cancellationReason = cancellationReason;
        }

        await booking.save();

        await booking.populate('therapist', 'firstName lastName email profilePhotoUrl');
        await booking.populate('patient', 'firstName lastName email');
        await booking.populate('payment');

        res.status(200).json({
            success: true,
            message: 'Booking has been cancelled successfully',
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// Delete booking (soft delete or hard delete)
export const deleteBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {id} = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error: CustomError = new Error('Invalid booking ID');
            error.statusCode = 400;
            throw error;
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            const error: CustomError = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        const userId = req.user?._id;
        if (!userId) {
            const error: CustomError = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }

        if (booking.status === 'completed') {
            const error: CustomError = new Error('You cannot delete a booking that has already been completed');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findById(userId);
        const therapist = await Therapist.findById(booking.therapist);
        const isPatient = booking.patient.toString() === userId;
        const isTherapist = therapist?.user.toString() === userId;
        const isAdmin = user?.role === 'admin';

        if (!isPatient && !isTherapist && !isAdmin) {
            const error: CustomError = new Error('You do not have permission to delete this booking');
            error.statusCode = 403;
            throw error;
        }

        await Booking.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Booking has been deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Get bookings grouped by date for a therapist
export const getBookingsGroupedByDate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {therapistId} = req.params;
        const {startDate, endDate, status} = req.query;

        if (!mongoose.Types.ObjectId.isValid(therapistId)) {
            const error: CustomError = new Error('Invalid therapist ID');
            error.statusCode = 400;
            throw error;
        }

        const therapist = await Therapist.findOne({_id: therapistId, deletedAt: null});
        if (!therapist) {
            const error: CustomError = new Error('Therapist not found');
            error.statusCode = 404;
            throw error;
        }

        const filter: any = {
            therapist: therapistId,
        };

        if (status) {
            const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduled'];
            if (validStatuses.includes(status as string)) {
                filter.status = status;
            }
        } else {
            filter.status = {$in: ['pending', 'confirmed', 'rescheduled', 'completed']};
        }

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                const start = new Date(startDate as string);
                if (!isNaN(start.getTime())) {
                    start.setHours(0, 0, 0, 0);
                    filter.date.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate as string);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.date.$lte = end;
                }
            }
        }

        const bookings = await Booking.find(filter)
            .populate('patient', 'firstName lastName email')
            .sort({date: 1, time: 1})
            .lean();

        const bookingsByDateMap = new Map<string, any[]>();

        bookings.forEach((booking) => {
            const dateKey = booking.date.toISOString().split('T')[0];

            if (!bookingsByDateMap.has(dateKey)) {
                bookingsByDateMap.set(dateKey, []);
            }

            bookingsByDateMap.get(dateKey)!.push({
                _id: booking._id,
                time: booking.time,
                duration: booking.duration,
                status: booking.status,
                patient: booking.patient,
                createdAt: booking.createdAt,
            });
        });

        const bookingsByDate = Array.from(bookingsByDateMap.entries()).map(([date, bookings]) => ({
            date,
            bookingCount: bookings.length,
            bookings,
        }));

        const totalBookings = bookings.length;

        res.status(200).json({
            success: true,
            message: 'Bookings grouped by date retrieved successfully',
            data: {
                therapistId,
                totalBookings,
                totalDates: bookingsByDate.length,
                bookingsByDate,
            },
        });
    } catch (error) {
        next(error);
    }
};

