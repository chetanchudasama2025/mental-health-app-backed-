import Booking from '../models/Booking';
import nodemailer from 'nodemailer';
import {getSessionReminderEmailTemplate} from '../templates/sessionReminderEmail';
import {isTwilioConfigured, twilioClient, twilioConfig} from '../config/twilio';

/**
 * Create email transporter
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER || 'yourEmail@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD || 'yourAppPassword',
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

/**
 * Send session reminder email
 */
const sendReminderEmail = async (
    patientEmail: string,
    patientName: string,
    therapistName: string,
    sessionDate: Date,
    sessionTime: string,
    duration: number
): Promise<void> => {
    try {
        const transporter = createTransporter();
        const emailHtml = getSessionReminderEmailTemplate(
            patientName,
            therapistName,
            sessionDate,
            sessionTime,
            duration
        );

        await transporter.sendMail({
            from: process.env.GMAIL_USER || 'yourEmail@gmail.com',
            to: patientEmail,
            subject: `Session Reminder: Your therapy session starts in 1 hour`,
            html: emailHtml,
        });
    } catch (error) {
        console.error(`Failed to send reminder email to ${patientEmail}:`, error);
        throw error;
    }
};

/**
 * Format phone number to E.164 format for Twilio
 */
const formatPhoneNumber = (countryCode: string, number: string): string => {
    if (!number || !countryCode) {
        throw new Error('Phone number and country code are required');
    }

    let cleanedNumber = number.replace(/[\s\-\(\)]/g, '');

    cleanedNumber = cleanedNumber.replace(/^0+/, '');

    let cleanedCountryCode = countryCode.trim();
    if (!cleanedCountryCode.startsWith('+')) {
        cleanedCountryCode = '+' + cleanedCountryCode;
    }

    const fullNumber = cleanedCountryCode + cleanedNumber;

    if (fullNumber.length < 10) {
        throw new Error(`Invalid phone number format: ${fullNumber}`);
    }

    return fullNumber;
};

/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 */
const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours12}:${minutesStr} ${period}`;
};

/**
 * Send session reminder SMS
 */
const sendReminderSMS = async (
    phoneNumber: string,
    patientName: string,
    therapistName: string,
    sessionDate: Date,
    sessionTime: string
): Promise<boolean> => {
    if (!isTwilioConfigured()) {
        console.warn('[SMS] Twilio is not configured. Skipping SMS reminder.');
        return false;
    }

    if (!twilioClient) {
        console.warn('[SMS] Twilio client is not available. Skipping SMS reminder.');
        return false;
    }

    if (!twilioConfig.phoneNumber) {
        console.warn('[SMS] Twilio phone number is not configured. Skipping SMS reminder.');
        return false;
    }

    try {
        const formattedDate = sessionDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        const formattedTime = formatTime12Hour(sessionTime);

        const message = `Session Reminder

Hi ${patientName},

Your therapy session with ${therapistName} starts in 1 hour.

Date: ${formattedDate}
Time: ${formattedTime}

Please join a few minutes early.`;

        await twilioClient.messages.create({
            body: message,
            from: twilioConfig.phoneNumber,
            to: phoneNumber,
        });

        return true;
    } catch (error: any) {
        console.error(`[SMS] Failed to send reminder SMS to ${phoneNumber}:`, error?.message || error);
        return false;
    }
};

/**
 * Calculate session start datetime from date and time
 */
const getSessionStartDateTime = (date: Date, time: string): Date => {
    const sessionDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);

    sessionDate.setHours(hours, minutes || 0, 0, 0);

    return sessionDate;
};

/**
 * Process session reminders for upcoming sessions
 */
export const processSessionReminders = async (): Promise<void> => {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        const upcomingBookings = await Booking.find({
            status: {$in: ['confirmed', 'pending']},
            reminderSent: {$ne: true},
        })
            .populate('patient', 'firstName lastName email phone')
            .populate('therapist', 'firstName lastName')
            .lean();

        if (upcomingBookings.length === 0) {
            return;
        }

        const remindersToSend: Array<{
            booking: any;
        }> = [];

        for (const booking of upcomingBookings) {
            const bookingDate = booking.date instanceof Date
                ? new Date(booking.date)
                : new Date(booking.date as any);

            const sessionStart = getSessionStartDateTime(bookingDate, booking.time);

            if (sessionStart >= now && sessionStart <= oneHourFromNow) {
                remindersToSend.push({
                    booking,
                });
            }
        }

        if (remindersToSend.length === 0) {
            return;
        }

        for (const {booking} of remindersToSend) {
            try {
                const patient = booking.patient as any;
                const therapist = booking.therapist as any;

                if (!patient || !therapist) {
                    console.error(`Missing patient or therapist data for booking ${booking._id}`);
                    continue;
                }

                const patientName = `${patient.firstName} ${patient.lastName}`;
                const therapistName = `${therapist.firstName} ${therapist.lastName}`;
                const patientEmail = patient.email;

                if (patientEmail) {
                    await sendReminderEmail(
                        patientEmail,
                        patientName,
                        therapistName,
                        booking.date,
                        booking.time,
                        booking.duration
                    );
                } else {
                    console.warn(`No email found for patient ${patient._id}`);
                }

                if (patient.phone?.number && patient.phone?.countryCode) {
                    try {
                        const phoneNumber = formatPhoneNumber(
                            patient.phone.countryCode,
                            patient.phone.number
                        );

                        await sendReminderSMS(
                            phoneNumber,
                            patientName,
                            therapistName,
                            booking.date,
                            booking.time
                        );
                    } catch (phoneError: any) {
                        console.error(`[SMS] Failed to send SMS reminder for booking ${booking._id}:`, phoneError.message);
                    }
                }

                await Booking.findByIdAndUpdate(booking._id, {
                    reminderSent: true,
                    reminderSentAt: new Date(),
                });
            } catch (error: any) {
                console.error(`Failed to send reminder for booking ${booking._id}:`, error.message);
            }
        }
    } catch (error: any) {
        console.error('Error processing session reminders:', error.message);
        throw error;
    }
};

