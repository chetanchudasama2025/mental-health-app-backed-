import {NextFunction, Request, Response} from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking';
import Therapist from '../models/Therapist';
import {User} from '../models/User';
import {Payment} from '../models/Payment';
import {CustomError} from '../middleware/errorHandler';
import {AuthRequest} from '../middleware/authMiddleware';

// Create a new booking
export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { therapistId, date, time, duration, payment, notes } = req.body;

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

    const therapist = await Therapist.findOne({ _id: therapistId, deletedAt: null });
    if (!therapist) {
      const error: CustomError = new Error('Therapist not found');
      error.statusCode = 404;
      throw error;
    }

    const patient = await User.findOne({ _id: patientId, deletedAt: null });
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
      status: { $in: ['pending', 'confirmed'] },
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
      .sort({ date: -1, time: -1 })
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
    const { id } = req.params;

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
    const { therapistId } = req.params;
    const { status, date, page = '1', limit = '10' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      const error: CustomError = new Error('Invalid therapist ID');
      error.statusCode = 400;
      throw error;
    }

    const therapist = await Therapist.findOne({ _id: therapistId, deletedAt: null });
    if (!therapist) {
      const error: CustomError = new Error('Therapist not found');
      error.statusCode = 404;
      throw error;
    }

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = { therapist: therapistId };

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
      .sort({ date: -1, time: -1 })
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
    const { status, date, page = '1', limit = '10' } = req.query;

    if (!patientId) {
      const error: CustomError = new Error('User not authenticated');
      error.statusCode = 401;
      throw error;
    }

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = { patient: patientId };

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
      .sort({ date: -1, time: -1 })
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

// Update booking
export const updateBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, time, duration, status, notes, cancellationReason } = req.body;

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

    const therapist = await Therapist.findById(booking.therapist);
    const isPatient = booking.patient.toString() === userId;
    const isTherapist = therapist?.user.toString() === userId;

    if (!isPatient && !isTherapist) {
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
    }

    if (time) {
      booking.time = time;
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
      if (!['pending', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(status)) {
        const error: CustomError = new Error('Invalid status');
        error.statusCode = 400;
        throw error;
      }

      if (status === 'cancelled' && booking.status !== 'cancelled') {
        booking.cancelledAt = new Date();
        if (cancellationReason) {
          booking.cancellationReason = cancellationReason;
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

// Cancel booking
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

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

    const therapist = await Therapist.findById(booking.therapist);
    const isPatient = booking.patient.toString() === userId;
    const isTherapist = therapist?.user.toString() === userId;

    if (!isPatient && !isTherapist) {
      const error: CustomError = new Error('You do not have permission to cancel this booking');
      error.statusCode = 403;
      throw error;
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
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
    const { id } = req.params;

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

