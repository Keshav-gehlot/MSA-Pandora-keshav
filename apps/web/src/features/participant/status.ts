// The database layer hands statuses back as plain strings. These narrow them to the values the screens know about.
// An unrecognised value falls back to "pending", the cautious reading: a team that can't be classified is treated as
// not yet verified and not yet shortlisted, so nothing is opened up by mistake.
export const PAYMENT_STATUSES = ["not_required", "pending", "approved", "declined"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const SHORTLIST_STATUSES = ["pending", "shortlisted", "not_shortlisted"] as const;
export type ShortlistStatusValue = (typeof SHORTLIST_STATUSES)[number];

export function toPaymentStatus(value: string): PaymentStatusValue {
  return (PAYMENT_STATUSES as readonly string[]).includes(value) ? (value as PaymentStatusValue) : "pending";
}

export function toShortlistStatus(value: string): ShortlistStatusValue {
  return (SHORTLIST_STATUSES as readonly string[]).includes(value) ? (value as ShortlistStatusValue) : "pending";
}
