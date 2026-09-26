export const TRACKS = ["Track A", "Track B", "Track C", "Track D"] as const;
export type Track = (typeof TRACKS)[number];

export const TEAM_SIZE = { min: 3, max: 4 } as const;
export const SRM_EMAIL_DOMAIN = "srmist.edu.in";
export const OTP = { length: 6, ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60, maxPerDay: 10 } as const;
export const SESSION_DAYS = 7;

const MB = 1024 * 1024;
export const UPLOADS = {
  photo: { maxBytes: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"] },
  paymentProof: { maxBytes: 5 * MB, types: ["image/jpeg", "image/png"] },
} as const;
