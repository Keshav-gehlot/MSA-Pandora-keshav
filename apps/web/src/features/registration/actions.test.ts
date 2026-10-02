import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetStorage = vi.fn();
const mockRegisterTeam = vi.fn();
const mockSendEmail = vi.fn();

vi.mock("@pandora/db", () => ({
  findMemberByEmail: vi.fn(),
  getStorage: () => mockGetStorage(),
  isTeamNameAvailable: vi.fn(),
  issueOtp: vi.fn(),
  registerTeam: (...args: unknown[]) => mockRegisterTeam(...args),
  verifyOtp: vi.fn(),
}));
vi.mock("@pandora/email", () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));
vi.mock("../../lib/cf-db", () => ({ getDb: async () => ({ fake: "db" }) }));

import { submitRegistration } from "./actions";

function member(n: number) {
  return {
    firstName: `Member${n}`,
    lastName: "Rao",
    regNumber: `RA261102601061${n}`,
    srmEmail: `member${n}@srmist.edu.in`,
    personalEmail: `member${n}@gmail.com`,
    phone: `987654321${n}`,
  };
}

function form(files: Record<string, File> = {}): FormData {
  const data = new FormData();
  data.set("registration", JSON.stringify({ teamName: "Alpha Team", track: "Track A", members: [member(1), member(2), member(3)] }));
  for (const [name, file] of Object.entries(files)) data.set(name, file);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  // A deployed preview without storage credentials.
  mockGetStorage.mockImplementation(() => {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set when deployed");
  });
  mockRegisterTeam.mockResolvedValue({ ok: true });
  mockSendEmail.mockResolvedValue({ ok: true, id: "x" });
});

describe("submitRegistration", () => {
  it("registers a team that uploads nothing without touching file storage", async () => {
    const result = await submitRegistration(form());

    expect(result).toEqual({ ok: true, teamName: "Alpha Team" });
    expect(mockGetStorage).not.toHaveBeenCalled();
    expect(mockRegisterTeam).toHaveBeenCalledTimes(1);
  });

  it("uses file storage when a photo is uploaded", async () => {
    const putFile = vi.fn().mockResolvedValue(undefined);
    mockGetStorage.mockReturnValue({ putFile });
    const photo = new File([new Uint8Array([1, 2, 3])], "me.png", { type: "image/png" });

    const result = await submitRegistration(form({ "photo-0": photo }));

    expect(result.ok).toBe(true);
    expect(putFile).toHaveBeenCalledTimes(1);
  });
});
