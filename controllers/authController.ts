import {NextFunction, Request, Response} from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto, {createHash, randomBytes} from "crypto";
import mongoose from "mongoose";
import {User} from "../models/User";
import {PasswordResetToken} from "../models/PasswordResetToken";
import {EmailVerificationToken} from "../models/EmailVerificationToken";
import {PhoneVerificationToken} from "../models/PhoneVerificationToken";
import Therapist from "../models/Therapist";
import {CustomError} from "../middleware/errorHandler";
import {AuthRequest} from "../middleware/authMiddleware";
import nodemailer from "nodemailer";
import {getForgotPasswordEmailTemplate} from "../templates/forgotPasswordEmail";
import {getEmailVerificationEmailTemplate} from "../templates/emailVerificationEmail";
import {isTwilioConfigured, sendOTP} from "../config/twilio";
import {decrypt, decryptCredentials} from "../utils/decryption";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GoogleProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale?: string;
}

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER || "yourEmail@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD || "yourAppPassword",
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const generateToken = (userId: string, tokenVersion: number): string => {
  const secret = JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return jwt.sign({userId, tokenVersion}, secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

const generateRefreshToken = (userId: string, tokenVersion: number): string => {
  const secret = JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return jwt.sign({userId, tokenVersion, type: "refresh"}, secret, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
};

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function base64url(buffer: Buffer) {
  return buffer
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
}

function generateVerifier() {
  return base64url(randomBytes(32));
}

function generateChallenge(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

const pkceStore = new Map<string, { verifier: string; expires: number }>();

// Send email verification OTP
const sendVerificationEmail = async (
    email: string,
    otp: string
): Promise<void> => {
  try {
    const transporter = createTransporter();
    const verificationEmailHtml = getEmailVerificationEmailTemplate(
        "User",
        otp
    );

    await transporter.sendMail({
      from: process.env.GMAIL_USER || "yourEmail@gmail.com",
      to: email,
      subject: "Verify Your Email Address - Mental Health App",
      html: verificationEmailHtml,
    });
  } catch (emailError) {
    console.error("Email sending error:", emailError);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Failed to send verification email");
    }
  }
};

// Register
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      country,
      timezone,
      password: encryptedPassword,
      role,
      emailVerified,
      privacyPolicyAccepted,
      termsOfServiceAccepted,
    } = req.body;

    let password: string;

    try {
      password = decrypt(encryptedPassword);
    } catch (decryptError) {
      const error: CustomError = new Error(
          "Failed to decrypt password. Invalid encryption."
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone?.countryCode ||
      !phone?.number ||
      emailVerified === undefined ||
      phone?.verified === undefined ||
      !dateOfBirth ||
      !gender ||
      !country ||
      !timezone ||
      !password
    ) {
      const error: CustomError = new Error("All fields are required");
      error.statusCode = 400;
      throw error;
    }

    if (emailVerified !== true || phone.verified !== true) {
      const error: CustomError = new Error(
          "Registration not allowed. Email and phone must be verified before creating an account."
      );
      error.statusCode = 400;
      throw error;
    }

    const validRoles = [
      "admin",
      "therapist",
      "patient",
      "superAdmin",
      "therapistManager",
      "supportAgent",
      "contentModerator",
    ];
    if (role && !validRoles.includes(role)) {
      const error: CustomError = new Error(
          "Invalid role. Role must be one of: admin, therapist, patient, superAdmin, therapistManager, supportAgent, contentModerator"
      );
      error.statusCode = 400;
      throw error;
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      deletedAt: null,
    });
    if (existingUser) {
      const error: CustomError = new Error(
          "User with this email already exists"
      );
      error.statusCode = 409;
      throw error;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      dateOfBirth,
      gender,
      country,
      timezone,
      password: hashedPassword,
      emailVerified,
      privacyPolicyAccepted: privacyPolicyAccepted || false,
      termsOfServiceAccepted: termsOfServiceAccepted || false,
      status: "pending",
      ...(role && { role }),
    });

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.emailVerified = false;
    await user.save();

    const userRole = role || "patient";

    if (userRole === "therapist") {
      const therapist = new Therapist({
        user: user._id,
        firstName,
        lastName,
        email: email.toLowerCase(),
        emailVerified: emailVerified || false,
        phone: phone,
        status: "pending",
        dateOfBirth,
        gender,
        country,
        timezone,
      });

      await therapist.save();

      user.therapist = new mongoose.Types.ObjectId(therapist.id);
      await user.save();
    }

    const token = generateToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    const refreshToken = generateRefreshToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    user.refreshToken = refreshToken;
    await user.save();

    const userResponse = user.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
        emailVerified: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      email: encryptedEmail,
      password: encryptedPassword,
      isRemember,
    } = req.body;

    if (!encryptedEmail || !encryptedPassword) {
      const error: CustomError = new Error("Email and password are required");
      error.statusCode = 400;
      throw error;
    }

    let email: string;
    let password: string;
    let rememberMe: boolean | undefined;

    try {
      const decryptedCredentials = decryptCredentials({
        email: encryptedEmail,
        password: encryptedPassword,
        isRemember,
      });
      email = decryptedCredentials.email;
      password = decryptedCredentials.password;
      rememberMe = decryptedCredentials.isRemember;
    } catch (decryptError: any) {
      console.error("Login decryption error:", {
        message: decryptError?.message,
        hasEmail: !!encryptedEmail,
        hasPassword: !!encryptedPassword,
        emailLength: encryptedEmail?.length,
        passwordLength: encryptedPassword?.length,
      });
      const error: CustomError = new Error(
          "Failed to decrypt credentials. Invalid encryption. Please ensure the encryption key matches between frontend and backend."
      );
      error.statusCode = 400;
      throw error;
    }

    if (!email || !password || email.trim() === "" || password.trim() === "") {
      const error: CustomError = new Error("Email and password are required");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      deletedAt: null,
    });
    if (!user) {
      const error: CustomError = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    if (!user.password) {
      const error: CustomError = new Error(
          "This account was created with social login. Please use social login to sign in."
      );
      error.statusCode = 401;
      throw error;
    }

    if (typeof password !== "string" || password.length === 0) {
      const error: CustomError = new Error("Invalid password format");
      error.statusCode = 400;
      throw error;
    }

    if (typeof user.password !== "string" || user.password.length === 0) {
      const error: CustomError = new Error("User password is not set");
      error.statusCode = 500;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error: CustomError = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    user.isRemember = rememberMe ?? false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    const refreshToken = generateRefreshToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    user.refreshToken = refreshToken;
    await user.save();

    const token = generateToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    const userResponse = user.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      const error: CustomError = new Error("Email is required");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      deletedAt: null,
    });
    if (!user) {
      res.status(200).json({
        success: true,
        message:
            "If an account with that email exists, a password reset link has been sent.",
      });
      return;
    }

    await PasswordResetToken.deleteMany({ userId: user._id });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      token: resetToken,
      expiresAt,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: "Password Reset Request",
        html: getForgotPasswordEmailTemplate(user.firstName, resetLink),
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Reset link sent successfully.",
      ...(process.env.NODE_ENV !== "production" && { resetToken }),
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      const error: CustomError = new Error("Token & new password required");
      error.statusCode = 400;
      throw error;
    }

    const resetTokenDoc = await PasswordResetToken.findOne({ token });
    if (!resetTokenDoc) {
      const error: CustomError = new Error("Invalid or expired reset token");
      error.statusCode = 400;
      throw error;
    }

    if (resetTokenDoc.expiresAt < new Date()) {
      await PasswordResetToken.findByIdAndDelete(resetTokenDoc._id);
      const error: CustomError = new Error("Reset link has expired");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      _id: resetTokenDoc.userId,
      deletedAt: null,
    });
    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    await PasswordResetToken.deleteMany({ userId: user._id });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get user
export const getUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const error: CustomError = new Error("Unauthorized: User ID missing");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findOne({_id: userId, deletedAt: null}).select(
        "-password"
    );

    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Verify email with OTP
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { otp, email } = req.body;

    if (!otp) {
      const error: CustomError = new Error("OTP is required");
      error.statusCode = 400;
      throw error;
    }

    const verificationToken = await EmailVerificationToken.findOne({
      email,
      deletedAt: null,
    });

    if (!verificationToken) {
      const error: CustomError = new Error(
          "Verification code not found. Please request a new OTP."
      );
      error.statusCode = 404;
      throw error;
    }

    const today = new Date();
    const isSameDay =
        verificationToken.lastAttemptDate &&
        new Date(verificationToken.lastAttemptDate).toDateString() ===
        today.toDateString();

    if (!isSameDay) {
      verificationToken.attemptsToday = 0;
    }

    if (verificationToken.attemptsToday >= 5) {
      const error: CustomError = new Error(
          "You have reached the maximum number of attempts for today. Try again tomorrow."
      );
      error.statusCode = 400;
      throw error;
    }

    if (verificationToken.expiresAt < new Date()) {
      verificationToken.deletedAt = new Date();
      await verificationToken.save();
      const error: CustomError = new Error(
          "Verification code has expired. Please request a new OTP."
      );
      error.statusCode = 400;
      throw error;
    }

    if (verificationToken.otp !== otp) {
      verificationToken.attemptsToday += 1;
      verificationToken.lastAttemptDate = today;
      await verificationToken.save();

      const remaining = 5 - verificationToken.attemptsToday;

      const error: CustomError = new Error(
          `Invalid verification code. ${remaining} attempts left today.`
      );
      error.statusCode = 400;
      throw error;
    }

    verificationToken.deletedAt = new Date();
    await verificationToken.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {emailVerified: true},
    });
  } catch (error) {
    next(error);
  }
};

// Send verification email (initial send after registration)
export const sendVerificationEmailAPI = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      const error: CustomError = new Error("Email is required");
      error.statusCode = 400;
      throw error;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await EmailVerificationToken.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        email: email.toLowerCase(),
        otp,
        expiresAt,
        attempts: 0,
        deletedAt: null,
      },
      { upsert: true, new: true }
    );

    try {
      await sendVerificationEmail(email, otp);
      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
        ...(process.env.NODE_ENV !== "production" && {otp}),
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error(
            "Failed to send verification email"
        );
        error.statusCode = 500;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "Verification email sent successfully",
          otp,
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

// Resend verification email
export const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      const error: CustomError = new Error("Email is required");
      error.statusCode = 400;
      throw error;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await EmailVerificationToken.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        email: email.toLowerCase(),
        otp,
        expiresAt,
        attempts: 0,
        deletedAt: null,
      },
      { upsert: true, new: true }
    );

    try {
      await sendVerificationEmail(email, otp);
      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
        ...(process.env.NODE_ENV !== "production" && {otp}),
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error(
            "Failed to send verification email"
        );
        error.statusCode = 500;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "Verification email sent successfully",
          otp,
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
      const error: CustomError = new Error("Unauthorized: User ID missing");
      error.statusCode = 401;
      throw error;
    }

    if (!oldPassword || !newPassword) {
      const error: CustomError = new Error(
          "Old password and new password are required"
      );
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error: CustomError = new Error(
          "New password must be at least 6 characters long"
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (!user.password || typeof user.password !== "string") {
      const error: CustomError = new Error(
          "User does not have a password set. Please set a password first."
      );
      error.statusCode = 400;
      throw error;
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      const error: CustomError = new Error("Old password is incorrect");
      error.statusCode = 401;
      throw error;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Add password (for users who registered with Google/OAuth)
export const addPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { password: encryptedPassword } = req.body;

    if (!userId) {
      const error: CustomError = new Error("Unauthorized: User ID missing");
      error.statusCode = 401;
      throw error;
    }

    if (!encryptedPassword) {
      const error: CustomError = new Error("Password is required");
      error.statusCode = 400;
      throw error;
    }

    let password: string;

    try {
      password = decrypt(encryptedPassword);
    } catch (decryptError) {
      const error: CustomError = new Error(
          "Failed to decrypt password. Invalid encryption."
      );
      error.statusCode = 400;
      throw error;
    }

    if (!password || password.trim() === "") {
      const error: CustomError = new Error("Password is required");
      error.statusCode = 400;
      throw error;
    }

    if (password.length < 6) {
      const error: CustomError = new Error(
          "Password must be at least 6 characters long"
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (
        user.password &&
        typeof user.password === "string" &&
        user.password.length > 0
    ) {
      const error: CustomError = new Error(
          "User already has a password set. Please use change-password endpoint to update it."
      );
      error.statusCode = 400;
      throw error;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password added successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Send verification phone OTP (initial send after registration)
export const sendVerificationPhoneAPI = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      const error: CustomError = new Error("Phone is required");
      error.statusCode = 400;
      throw error;
    }

    const phoneNumber = `${phone.countryCode}${phone.number}`;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PhoneVerificationToken.findOneAndUpdate(
      { phone: phoneNumber },
      {
        phone: phoneNumber,
        otp,
        expiresAt,
        attempts: 0,
        deletedAt: null,
      },
      { upsert: true, new: true }
    );

    if (!isTwilioConfigured()) {
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error(
            "SMS service is not configured. Please contact support."
        );
        error.statusCode = 503;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "Verification code generated",
          otp,
        });
        return;
      }
    }

    try {
      await sendOTP(phoneNumber, otp);
      res.status(200).json({
        success: true,
        message: "Verification SMS sent successfully",
        ...(process.env.NODE_ENV !== "production" && {otp}),
      });
    } catch (smsError) {
      console.error("SMS sending error:", smsError);
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error("Failed to send verification SMS");
        error.statusCode = 500;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "Verification SMS failed to send",
          otp,
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

// Verify phone with OTP
export const verifyPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { otp, phone } = req.body;

    if (!otp) {
      const error: CustomError = new Error("OTP is required");
      error.statusCode = 400;
      throw error;
    }

    if (!phone) {
      const error: CustomError = new Error("Phone is required");
      error.statusCode = 400;
      throw error;
    }

    const phoneNumber = `${phone.countryCode}${phone.number}`;
    const verificationToken = await PhoneVerificationToken.findOne({
      phone: phoneNumber,
      deletedAt: null,
    });

    if (!verificationToken) {
      const error: CustomError = new Error(
          "Verification code not found. Please request a new one."
      );
      error.statusCode = 404;
      throw error;
    }

    const today = new Date();
    const isSameDay =
        verificationToken.lastAttemptDate &&
        new Date(verificationToken.lastAttemptDate).toDateString() ===
        today.toDateString();

    if (!isSameDay) {
      verificationToken.attemptsToday = 0;
    }

    if (verificationToken.attemptsToday >= 5) {
      const error: CustomError = new Error(
          "You have reached the maximum number of attempts for today. Try again tomorrow."
      );
      error.statusCode = 400;
      throw error;
    }

    if (verificationToken.expiresAt < new Date()) {
      verificationToken.deletedAt = new Date();
      await verificationToken.save();
      const error: CustomError = new Error(
          "Verification code has expired. Please request a new one."
      );
      error.statusCode = 400;
      throw error;
    }

    if (verificationToken.otp !== otp) {
      verificationToken.attemptsToday += 1;
      verificationToken.lastAttemptDate = today;
      await verificationToken.save();

      const remaining = 5 - verificationToken.attemptsToday;

      const error: CustomError = new Error(
          `Invalid verification code. ${remaining} attempts left today.`
      );
      error.statusCode = 400;
      throw error;
    }

    verificationToken.deletedAt = new Date();
    await verificationToken.save();

    res.status(200).json({
      success: true,
      message: "Phone verified successfully",
      data: {phoneVerified: true},
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification phone OTP
export const resendVerificationPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      const error: CustomError = new Error("Phone is required");
      error.statusCode = 400;
      throw error;
    }

    const phoneNumber = `${phone.countryCode}${phone.number}`;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PhoneVerificationToken.findOneAndUpdate(
      { phone: phoneNumber },
      {
        phone: phoneNumber,
        otp,
        expiresAt,
        attempts: 0,
        deletedAt: null,
      },
      { upsert: true, new: true }
    );

    if (!isTwilioConfigured()) {
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error(
            "SMS service is not configured. Please contact support."
        );
        error.statusCode = 503;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "resend verification phone OTP",
          otp,
        });
        return;
      }
    }

    try {
      await sendOTP(phoneNumber, otp);
      res.status(200).json({
        success: true,
        message: "Verification SMS sent successfully",
        ...(process.env.NODE_ENV !== "production" && {otp}),
      });
    } catch (smsError) {
      console.error("SMS sending error:", smsError);
      if (process.env.NODE_ENV === "production") {
        const error: CustomError = new Error("Failed to send verification SMS");
        error.statusCode = 500;
        throw error;
      } else {
        res.status(200).json({
          success: true,
          message: "Verification SMS failed to send",
          otp,
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

// Refresh token
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: providedRefreshToken } = req.body;

    if (!providedRefreshToken) {
      const error: CustomError = new Error("Refresh token is required");
      error.statusCode = 400;
      throw error;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(providedRefreshToken, JWT_SECRET);
    } catch (err) {
      const error: CustomError = new Error("Invalid or expired refresh token");
      error.statusCode = 401;
      throw error;
    }

    if (decoded.type !== "refresh") {
      const error: CustomError = new Error("Invalid token type");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findOne({
      _id: decoded.userId,
      deletedAt: null,
    });

    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.refreshToken !== providedRefreshToken) {
      const error: CustomError = new Error("Invalid refresh token");
      error.statusCode = 401;
      throw error;
    }

    const currentTokenVersion = user.tokenVersion || 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentTokenVersion) {
      user.refreshToken = null;
      await user.save();
      const error: CustomError = new Error(
          "Refresh token has been invalidated. Please login again."
      );
      error.statusCode = 401;
      throw error;
    }

    const newToken = generateToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    const newRefreshToken = generateRefreshToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth2 authentication
export const googleAuth = async (
    req: Request,
    res: Response
): Promise<Response | void> => {
  if (!process.env.REDIRECT_URL) {
    console.error("❌ REDIRECT_URL is missing in .env");
    return res
        .status(500)
        .send("Server configuration error: Missing redirect URL");
  }

  const role = req.query.role as string;

  if (!role) {
    return res
        .status(400)
        .json({message: "Role is required (patient | therapist)"});
  }

  const state = Buffer.from(JSON.stringify({ role })).toString("base64");

  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);

  pkceStore.set(state, { verifier, expires: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URL!,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  params.append("prompt", "select_account");

  res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
};

// Google OAuth2 authentication callback
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
      res.status(400).send("Invalid Google auth session");
      return;
    }

    const stateDecoded = JSON.parse(Buffer.from(state, "base64").toString());
    const roleFromState = stateDecoded.role as
        | "patient"
        | "therapist"
        | undefined;

    const session = pkceStore.get(state);
    pkceStore.delete(state);

    if (!session) {
      res.status(400).send("Session expired");
      return;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        code_verifier: session.verifier,
        grant_type: "authorization_code",
        redirect_uri: process.env.REDIRECT_URL!,
      }),
    });

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokens.access_token) {
      throw new Error("Google token exchange failed");
    }

    const profileRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {Authorization: `Bearer ${tokens.access_token}`},
        }
    );

    const profile = (await profileRes.json()) as GoogleProfile;

    if (!profile.email) {
      throw new Error("Failed to retrieve email from Google profile");
    }

    const googleId = profile.id;
    const email = profile.email.toLowerCase();
    const firstName = profile.given_name || "";
    const lastName = profile.family_name || "";
    const picture = profile.picture;

    let user = await User.findOne({ email, deletedAt: null });

    if (!user) {
      if (!roleFromState) {
        return res.redirect(
            `${process.env.FRONTEND_URL}/select-role?email=${email}`
        );
      }

      user = await User.create({
        firstName,
        lastName,
        email,
        googleId,
        profilePhoto: picture,
        password: null,
        emailVerified: true,
        role: roleFromState,
        phone: { countryCode: "", number: "", verified: false },
        privacyPolicyAccepted: true,
        termsOfServiceAccepted: true,
        status: "active",
      });

      if (roleFromState === "therapist") {
        const therapist = await Therapist.create({
          user: user._id,
          firstName,
          lastName,
          email,
          emailVerified: true,
          profilePhoto: picture,
          phone: { countryCode: "", number: "", verified: false },
          status: "pending",
          timezone: "UTC",
        });

        user.therapist = therapist._id as mongoose.Types.ObjectId;
        await user.save();
      }
    } else {
      user.googleId = googleId;
      if (!user.profilePhoto) user.profilePhoto = picture;
    }

    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    const refreshToken = generateRefreshToken(
      (user._id as mongoose.Types.ObjectId).toString(),
      user.tokenVersion
    );

    user.refreshToken = refreshToken;
    await user.save();

    const userId = user._id as mongoose.Types.ObjectId;

    const token = generateToken(userId.toString(), user.tokenVersion);

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard/home?token=${token}&refreshToken=${refreshToken}&id=${userId}&role=${user.role}`
    );
  } catch (err) {
    console.error("Google OAuth Error →", err);
    next(err);
  }
};
