# Mental Health Application - Backend API

A comprehensive RESTful API backend for a Mental Health Application built with Node.js, Express, TypeScript, and MongoDB. This application provides secure authentication, therapist management, booking system, messaging, payments, and support ticket functionality.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Database Models](#database-models)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Deployment](#deployment)

## ✨ Features

- **User Authentication & Authorization**
  - User registration with email verification (OTP-based)
  - JWT-based authentication
  - Password reset functionality
  - Role-based access control (Admin, Therapist, Patient, SuperAdmin, TherapistManager, SupportAgent, ContentModerator)
  - Privacy policy and terms of service acceptance tracking
  - User status management (active, inactive, pending, blocked, suspended)

- **Therapist Management**
  - Therapist profile creation and management
  - Therapist status workflow (approved, pending, rejected, underReview)
  - Specializations and bio management
  - Profile photo uploads (Cloudinary integration)
  - Education, certifications, and experience tracking
  - Review notes (admin-only)

- **Booking System**
  - Session booking with therapists
  - Multiple duration options (30, 45, 60 minutes)
  - Booking status management (pending, confirmed, completed, cancelled, no-show)
  - Conflict prevention and validation

- **Payment Integration**
  - Payment processing with Stripe integration
  - Payment status tracking
  - Receipt management
  - Payment history

- **Messaging System**
  - Real-time conversation management
  - Message sending and receiving
  - Read receipts and unread counts
  - Message deletion

- **Support Tickets**
  - Ticket creation and management
  - Priority levels and status tracking
  - Admin response system

- **Notifications**
  - In-app notifications
  - Notification types (session_booked, payment, message, system)
  - Read/unread status tracking

- **Availability Management**
  - Therapist availability scheduling
  - Time slot management
  - Recurring availability patterns

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **File Upload**: Multer + Cloudinary
- **Email Service**: Nodemailer (Gmail)
- **Development**: Nodemon, ts-node

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (local or cloud instance like MongoDB Atlas)
- Gmail account with App Password (for email functionality)
- Cloudinary account (for image uploads)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-mental-health-app-MHA
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory (see [Environment Variables](#environment-variables))

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Or start the production server:
   ```bash
   npm start
   ```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mental-health-app
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mental-health-app

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Email Configuration (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# Twilio Configuration (for SMS/Phone Verification)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Frontend URL
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Getting Gmail App Password

1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password for "Mail"
5. Use this password in `GMAIL_APP_PASSWORD`

### Getting Twilio Credentials

1. Sign up for a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token from the Twilio Console Dashboard
3. Purchase a phone number from Twilio (or use a trial number for testing)
4. Add these values to your `.env` file:
   - `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER`: Your Twilio phone number (format: +1234567890)

## 📁 Project Structure

```
backend-mental-health-app-MHA/
├── config/                 # Configuration files
│   ├── database.ts        # MongoDB connection
│   ├── cloudinary.ts      # Cloudinary configuration
│   └── twilio.ts          # Twilio SMS configuration
├── controllers/           # Route controllers
│   ├── authController.ts
│   ├── userController.ts
│   ├── therapistController.ts
│   ├── bookingController.ts
│   ├── paymentController.ts
│   ├── messageController.ts
│   ├── notificationController.ts
│   ├── supportTicketController.ts
│   └── availabilityController.ts
├── middleware/            # Express middleware
│   ├── authMiddleware.ts  # JWT authentication
│   ├── errorHandler.ts   # Error handling
│   ├── logger.ts         # Request logging
│   └── uploadMiddleware.ts # File upload handling
├── models/               # Mongoose models
│   ├── User.ts
│   ├── Therapist.ts
│   ├── Booking.ts
│   ├── Payment.ts
│   ├── Message.ts
│   ├── Conversation.ts
│   ├── Notification.ts
│   ├── SupportTicket.ts
│   ├── Availability.ts
│   ├── EmailVerificationToken.ts
│   ├── PhoneVerificationToken.ts
│   └── PasswordResetToken.ts
├── routes/               # API routes
│   ├── index.ts         # Main router
│   ├── authRoutes.ts
│   ├── userRoutes.ts
│   ├── therapistRoutes.ts
│   ├── bookingRoutes.ts
│   ├── paymentRoutes.ts
│   ├── messageRoutes.ts
│   ├── notificationRoutes.ts
│   ├── supportTicketRoutes.ts
│   └── availabilityRoutes.ts
├── templates/           # Email templates
│   ├── emailVerificationEmail.ts
│   └── forgotPasswordEmail.ts
├── types/               # TypeScript type definitions
├── index.ts            # Application entry point
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md          # This file
```

## 🗄 Database Models

### User
- Basic user information (name, email, phone, date of birth, gender, country, timezone)
- Role-based access (admin, therapist, patient, superAdmin, therapistManager, supportAgent, contentModerator)
- Email verification status
- Phone verification status (with countryCode, number, verified)
- Password hashing with bcrypt
- User status (active, inactive, pending, blocked, suspended) - default: active
- Privacy policy and terms of service acceptance tracking
- Account deletion reason tracking
- Soft delete support

### Therapist
- Extended profile for therapists
- Specializations, bio, profile photo, video intro
- Status workflow (approved, pending, rejected, underReview) - default: pending
- Education, certifications, and experience arrays with validation status
- Email verification status
- Phone verification (with countryCode, number, verified)
- Required timezone field
- Review notes (admin-only field)
- Linked to User model

### Booking
- Links therapist and patient
- Date, time, duration (30/45/60 minutes)
- Status (pending, confirmed, completed, cancelled, no-show)
- Payment reference
- Notes and cancellation reason

### Payment
- User payment records
- Payment intent ID and client secret (Stripe)
- Amount, currency, status
- Receipt URL and metadata
- Soft delete support

### Conversation & Message
- One-to-one conversations between users
- Messages with read receipts
- Unread count tracking
- Soft delete support

### Notification
- In-app notifications
- Multiple notification types
- Read/unread status
- Metadata support

### SupportTicket
- Support ticket system
- Priority levels and status
- Admin responses

### Availability
- Therapist availability slots
- Recurring patterns
- Time zone support

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Authentication (`/api/auth`)
- `POST /register` - Register a new user
- `POST /login` - Login and get JWT token
- `GET /me` - Get current authenticated user
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `POST /change-password` - Change password (authenticated)
- `POST /send-verification-email` - Send email verification OTP
- `POST /verify-email` - Verify email with OTP
- `POST /resend-verification-email` - Resend verification email
- `POST /send-verification-phone` - Send phone verification OTP via SMS
- `POST /verify-phone` - Verify phone with OTP
- `POST /resend-verification-phone` - Resend phone verification OTP

#### Users (`/api/users`)
- `POST /` - Create user (admin)
- `GET /me` - Get current user profile
- `GET /` - Get all users (with filters: role, country, gender, status)
- `GET /:id` - Get user by ID
- `PUT /:id` - Update user (users can update: firstName, lastName, email, phone, dateOfBirth, gender, country, timezone, privacyPolicyAccepted, termsOfServiceAccepted; admins can also update: role, status)
- `DELETE /:id` - Delete user (soft delete)

#### Therapists (`/api/therapists`)
- `POST /` - Create therapist profile (required: userId, firstName, lastName, email, timezone)
- `GET /` - Get all therapists (with filters: search, specialization, language, status)
- `GET /:id` - Get therapist by ID
- `GET /user/:userId` - Get therapist by user ID
- `PUT /:id` - Update therapist (admins can update: status, emailVerified, reviewNotes)
- `DELETE /:id` - Delete therapist

#### Bookings (`/api/bookings`)
- `POST /` - Create booking (authenticated)
- `GET /` - Get all bookings (with filters)
- `GET /me` - Get current user's bookings
- `GET /:id` - Get booking by ID
- `GET /therapist/:therapistId` - Get bookings by therapist
- `PUT /:id` - Update booking
- `POST /:id/cancel` - Cancel booking
- `DELETE /:id` - Delete booking

#### Payments (`/api/payments`)
- `POST /` - Create payment (authenticated)
- `GET /` - Get all payments (with filters)
- `GET /me` - Get current user's payments
- `GET /user/:userId` - Get payments by user ID
- `GET /:id` - Get payment by ID
- `PUT /:id` - Update payment
- `DELETE /:id` - Delete payment (soft delete)

#### Messages (`/api/conversations` & `/api/messages`)
- `POST /conversations` - Create or get conversation
- `GET /conversations` - Get user conversations
- `GET /conversations/:id` - Get conversation by ID
- `GET /messages/:id` - Get conversation messages
- `POST /messages/:id` - Send message
- `POST /messages/read` - Mark messages as read
- `DELETE /messages/:id` - Delete message
- `DELETE /conversations/:id` - Delete conversation

#### Notifications (`/api/notifications`)
- `POST /` - Create notification
- `GET /` - Get user notifications
- `GET /:id` - Get notification by ID
- `PUT /:id/read` - Mark as read
- `POST /read/all` - Mark all as read
- `DELETE /:id` - Delete notification

#### Support Tickets (`/api/support-tickets`)
- `POST /` - Create support ticket
- `GET /` - Get all tickets (with filters)
- `GET /:id` - Get ticket by ID
- `PUT /:id` - Update ticket
- `POST /:id/respond` - Add response to ticket
- `DELETE /:id` - Delete ticket

#### Availability (`/api/availabilities`)
- `POST /` - Create availability (therapist)
- `GET /` - Get availabilities (with filters)
- `GET /:id` - Get availability by ID
- `PUT /:id` - Update availability
- `DELETE /:id` - Delete availability

### Response Format

All API responses follow this format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

### Pagination

List endpoints support pagination and filtering:
```
GET /api/users?page=1&limit=10&role=patient&status=active
GET /api/therapists?page=1&limit=10&status=approved&specialization=Anxiety
```

**User Filters:**
- `role`: Filter by user role (admin, therapist, patient, superAdmin, therapistManager, supportAgent, contentModerator)
- `country`: Filter by country (case-insensitive partial match)
- `gender`: Filter by gender (male, female, other)
- `status`: Filter by user status (active, inactive, pending, blocked, suspended)

**Therapist Filters:**
- `search`: Search in firstName, lastName, email, or bio
- `specialization`: Filter by specialization
- `language`: Filter by language
- `status`: Filter by therapist status (approved, pending, rejected, underReview)

Response includes pagination metadata:
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

## 🔒 Authentication

### Registration Flow

1. User registers via `POST /api/auth/register`
   - Required fields: firstName, lastName, email, phone (with countryCode, number, verified), dateOfBirth, gender, country, timezone, password, emailVerified
   - Optional fields: role, privacyPolicyAccepted, termsOfServiceAccepted
   - New users start with status: "pending"
2. User receives JWT token (email not verified yet)
3. User calls `POST /api/auth/send-verification-email` to receive OTP
4. User verifies email via `POST /api/auth/verify-email` with OTP
5. Email is marked as verified
6. Admin can update user status to "active" after verification

### JWT Token

- Tokens are included in the `Authorization` header
- Format: `Bearer <token>`
- Default expiration: 7 days
- Token versioning for logout/invalidation support

### Email Verification

- 6-digit OTP sent via email
- OTP expires in 10 minutes
- Maximum 5 verification attempts
- OTP is deleted after successful verification

### Phone Verification

- 6-digit OTP sent via SMS using Twilio
- OTP expires in 10 minutes
- Maximum 5 verification attempts
- OTP is deleted after successful verification
- Phone number format: country code + number (e.g., +1234567890)

### Password Reset

1. User requests reset via `POST /api/auth/forgot-password`
2. Reset token sent to email (expires in 1 hour)
3. User resets password via `POST /api/auth/reset-password`

## ⚠️ Error Handling

The API uses a centralized error handler. All errors follow this structure:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## 🧪 Testing

### Using Postman

A complete, properly organized Postman collection is included with comprehensive documentation:

**Files:**

- `Mental_Health_App_API.postman_collection.json` - Complete API collection organized by modules
- `Mental_Health_App_API.postman_environment.json` - Environment variables for easy setup
- `POSTMAN_COLLECTION_GUIDE.md` - Comprehensive guide with detailed instructions
- `POSTMAN_QUICK_REFERENCE.md` - Quick reference for all endpoints

**Quick Start:**

1. Import both the collection and environment into Postman
2. Select "Mental Health App - Development" environment
3. Update `baseUrl` if needed (default: `http://localhost:3000`)
4. Test the Health Check endpoint first
5. Register/Login to get tokens (automatically saved to environment)
6. Start testing endpoints by module

**Collection Structure:**

-
    01. Health Check
-
    02. Authentication (17 endpoints)
-
    03. Users (7 endpoints)
-
    04. Therapists (8 endpoints)
-
    05. Availabilities (6 endpoints)
-
    06. Bookings (9 endpoints)
-
    07. Payments (8 endpoints)
-
    08. Messages & Conversations (8 endpoints)
-
    09. Notifications (8 endpoints)
-
    10. Support Tickets (5 endpoints)
-
    11. Reviews (7 endpoints)
-
    12. Contact Us (5 endpoints)

**See `POSTMAN_COLLECTION_GUIDE.md` for detailed usage instructions and workflows.**

### Manual Testing

1. Start the server: `npm run dev`
2. Use tools like Postman, Insomnia, or curl
3. Test endpoints in order:
   - Register → Login → Send Verification Email → Verify Email
   - Then test other endpoints with authentication

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong `JWT_SECRET`
   - Configure production MongoDB URI
   - Set up production email credentials
   - Configure Cloudinary production settings

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

4. **Recommended: Use PM2**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name mental-health-api
   pm2 save
   pm2 startup
   ```

### Environment-Specific Notes

- **Development**: OTP codes are returned in API responses
- **Production**: OTP codes are only sent via email
- **Security**: Always use HTTPS in production
- **Database**: Use MongoDB Atlas or secure MongoDB instance
- **CORS**: Configure `CLIENT_URL` for production frontend

## 📝 Additional Notes

### User Status Management
- **Status Values**: active, inactive, pending, blocked, suspended
- **Default Status**: 
  - New registrations: "pending"
  - OAuth users: "active"
  - Admin-created users: "active" (or specified)
- **Status Updates**: Only admins can update user status

### Therapist Status Workflow
- **Status Values**: approved, pending, rejected, underReview
- **Default Status**: "pending" for all new therapist profiles
- **Status Updates**: Only admins can update therapist status
- **Review Notes**: Admins can add review notes when updating therapist status

### Privacy & Terms Acceptance
- Users can accept privacy policy and terms of service during registration
- These fields can be updated by users in their profile
- OAuth users automatically accept both (set to true)

### Soft Delete
Most models support soft delete using `deletedAt` field. Deleted records are excluded from queries but remain in the database.

### File Uploads
Profile photos are uploaded to Cloudinary. Maximum file size and allowed types are configured in upload middleware.

### Email Templates
HTML email templates are located in `templates/` directory. They use inline CSS for email client compatibility.

### TypeScript
The project is fully typed with TypeScript. Type definitions are in the `types/` directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License

## 👥 Support

For issues and questions, please contact the development team or create an issue in the repository.

---

**Last Updated**: 2025
**Version**: 1.0.0

