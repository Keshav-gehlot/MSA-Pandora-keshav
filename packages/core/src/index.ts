export { pageTitle, siteConfig } from "./site";
export { OTP, SESSION_DAYS, SRM_EMAIL_DOMAIN, TEAM_SIZE, TRACKS, UPLOADS, type Track } from "./config";
export {
  memberSchema,
  nameSchema,
  otpCodeSchema,
  personalEmailSchema,
  phoneSchema,
  regNumberSchema,
  registrationSchema,
  srmEmailSchema,
  teamNameKey,
  teamNameSchema,
  trackSchema,
  type Member,
  type MemberInput,
  type Registration,
  type RegistrationInput,
} from "./rules";
export { applyChanges, diffTeam, type FieldChange, type TeamSnapshot } from "./diff";
