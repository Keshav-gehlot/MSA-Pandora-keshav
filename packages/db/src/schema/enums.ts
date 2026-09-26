import { pgEnum } from "drizzle-orm/pg-core";

export const paymentStatus = pgEnum("payment_status", ["not_required", "pending", "approved", "declined"]);
export const shortlistStatus = pgEnum("shortlist_status", ["pending", "shortlisted", "not_shortlisted"]);
export const otpPurpose = pgEnum("otp_purpose", ["registration", "participant_sign_in", "staff_sign_in"]);
export const sessionSubject = pgEnum("session_subject", ["member", "staff"]);
export const staffRole = pgEnum("staff_role", ["admin", "staff"]);
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "declined"]);
