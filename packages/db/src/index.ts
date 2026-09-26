export { createDb, getDb, type Db } from "./client";
export { uniqueViolationField, type UniqueField } from "./errors";
export {
  claimVerifiedOtp,
  createSession,
  findMemberByEmail,
  findStaffByEmail,
  getMemberWithTeam,
  getSession,
  getStaffById,
  issueOtp,
  revokeSession,
  verifyOtp,
  type OtpPurpose,
} from "./queries/auth";
export { getStorage, diskStorage, STORAGE_BUCKET, supabaseStorage, type Storage } from "./storage";
