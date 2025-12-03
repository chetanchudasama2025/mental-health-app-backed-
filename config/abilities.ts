import { defineAbility } from "@casl/ability";
import { IUser } from "../models/User";

export type Actions = "create" | "read" | "update" | "delete" | "manage";

export type Subjects =
    | "User"
    | "Therapist"
    | "Booking"
    | "Payment"
    | "Message"
    | "Conversation"
    | "Notification"
    | "SupportTicket"
    | "Availability"
    | "all";

export type AppAbility = ReturnType<typeof defineAbilitiesFor>;

export function defineAbilitiesFor(user: IUser) {
    return defineAbility((can, cannot) => {

        if (user.role === "admin") {
            can("manage", "all");
            return;
        }

        // ================= THERAPIST =================
        if (user.role === "therapist") {
            // Self User profile
            can("read", "User", { _id: user._id });
            can("update", "User", { _id: user._id });

            // Own Therapist Profile
            can("read", "Therapist", { user: user._id });
            can("create", "Therapist", { user: user._id });
            can("update", "Therapist", { user: user._id });

            // Availability Control
            can("manage", "Availability", { therapist: user._id });

            // Own Bookings
            can("read", "Booking", { therapist: user._id });
            can("update", "Booking", { therapist: user._id });

            // Read Only Payments For His Sessions
            can("read", "Payment");

            // Communication
            can("read", "Conversation", { participants: user._id });
            can("create", "Conversation");
            can("read", "Message", { sender: user._id });
            can("create", "Message", { sender: user._id });
            can("update", "Message", { sender: user._id });
            can("delete", "Message", { sender: user._id });

            // Notifications
            can("read", "Notification", { user: user._id });
            can("update", "Notification", { user: user._id });
            can("delete", "Notification", { user: user._id });

            // Support Tickets
            can("create", "SupportTicket", { userId: user._id });
            can("read", "SupportTicket", { userId: user._id });
            can("update", "SupportTicket", { userId: user._id });
            return;
        }

        // ================= PATIENT =================
        if (user.role === "patient") {
            can("read", "User", { _id: user._id });
            can("update", "User", { _id: user._id });

            // Therapist Public View
            can("read", "Therapist");
            can("read", "Availability");

            // Bookings
            can("create", "Booking", { patient: user._id });
            can("read", "Booking", { patient: user._id });
            can("update", "Booking", { patient: user._id });
            can("delete", "Booking", { patient: user._id });

            // Payments
            can("create", "Payment", { user: user._id });
            can("read", "Payment", { user: user._id });
            can("update", "Payment", { user: user._id });

            // Messaging
            can("read", "Conversation", { participants: user._id });
            can("create", "Conversation");
            can("read", "Message", { sender: user._id });
            can("create", "Message", { sender: user._id });
            can("update", "Message", { sender: user._id });
            can("delete", "Message", { sender: user._id });

            // Notifications
            can("read", "Notification", { user: user._id });
            can("update", "Notification", { user: user._id });
            can("delete", "Notification", { user: user._id });

            // Support Ticket
            can("create", "SupportTicket", { userId: user._id });
            can("read", "SupportTicket", { userId: user._id });
            can("update", "SupportTicket", { userId: user._id });
            return;
        }

        // Default No Access
        cannot("manage", "all");
    });
}
