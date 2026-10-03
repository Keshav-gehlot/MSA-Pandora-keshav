import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffMock = vi.fn();
const getFileMock = vi.fn();

vi.mock("../../../lib/session", () => ({ requireStaff: (...args: unknown[]) => requireStaffMock(...args) }));
vi.mock("../../../lib/cf-storage", () => ({ getStorage: async () => ({ getFile: (...args: unknown[]) => getFileMock(...args) }) }));

import { GET } from "./route";

const TEAM = "11111111-1111-4111-8111-111111111111";
const call = (path: string) => GET(new Request("http://console.test/files/" + path), { params: Promise.resolve({ path: path.split("/") }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffMock.mockResolvedValue({ id: "staff-1", role: "staff" });
  getFileMock.mockResolvedValue({ body: new Uint8Array([1, 2, 3]), contentType: "image/png" });
});

describe("GET /files/...", () => {
  it("serves a photo to signed-in staff with a private, non-sniffable response", async () => {
    const response = await call(`teams/${TEAM}/photos/1.png`);

    expect(response.status).toBe(200);
    expect(requireStaffMock).toHaveBeenCalledWith(undefined);
    expect(getFileMock).toHaveBeenCalledWith(`teams/${TEAM}/photos/1.png`);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("requires an admin for a payment proof", async () => {
    await call(`teams/${TEAM}/payment/22222222-2222-4222-8222-222222222222.jpg`);

    expect(requireStaffMock).toHaveBeenCalledWith("admin");
  });

  it("does not read the file when sign-in fails", async () => {
    requireStaffMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(call(`teams/${TEAM}/photos/1.png`)).rejects.toThrow("NEXT_REDIRECT");
    expect(getFileMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing file", async () => {
    getFileMock.mockResolvedValue(null);

    expect((await call(`teams/${TEAM}/photos/9.png`)).status).toBe(404);
  });

  it.each([
    "teams/../etc/passwd",
    `teams/${TEAM}/other/1.png`,
    `teams/not-a-uuid/photos/1.png`,
    `teams/${TEAM}/photos/sub/1.png`,
    "secrets.env",
  ])("answers 404 for a path outside the upload folders: %s", async (path) => {
    const response = await call(path);

    expect(response.status).toBe(404);
    expect(requireStaffMock).not.toHaveBeenCalled();
    expect(getFileMock).not.toHaveBeenCalled();
  });
});
