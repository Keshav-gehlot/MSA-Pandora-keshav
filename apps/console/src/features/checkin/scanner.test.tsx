// @vitest-environment jsdom
import React, { act } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Provide global React for Node/jsdom test execution
(globalThis as unknown as { React: typeof React; IS_REACT_ACT_ENVIRONMENT: boolean }).React = React;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock server actions
const mockLookupScan = vi.fn();
const mockConfirmCheckIn = vi.fn();
const mockSearchMembers = vi.fn();

vi.mock("./actions", () => ({
  lookupScan: (...args: unknown[]) => mockLookupScan(...args),
  confirmCheckIn: (...args: unknown[]) => mockConfirmCheckIn(...args),
  searchMembers: (...args: unknown[]) => mockSearchMembers(...args),
}));

// Mock jsqr
const mockJsQR = vi.fn();
vi.mock("jsqr", () => ({
  default: (...args: unknown[]) => mockJsQR(...args),
}));

import { CheckinScanner } from "./scanner";

describe("CheckinScanner behavior", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  // Stubs for media tracks and stream
  let stopTrackMock: ReturnType<typeof vi.fn>;
  let fakeStream: MediaStream;
  let getUserMediaMock: ReturnType<typeof vi.fn>;

  // Stubs for canvas context
  let mockDrawImage: ReturnType<typeof vi.fn>;
  let mockGetImageData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);

    stopTrackMock = vi.fn();
    fakeStream = {
      getTracks: () => [
        {
          kind: "video",
          stop: stopTrackMock,
          enabled: true,
        },
        {
          kind: "video",
          stop: stopTrackMock,
          enabled: true,
        },
      ],
    } as unknown as MediaStream;

    getUserMediaMock = vi.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: getUserMediaMock,
      },
      writable: true,
      configurable: true,
    });

    // Stub video element properties required by scanner.tsx
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { value: 640, writable: true, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { value: 480, writable: true, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", { value: 4, writable: true, configurable: true });
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    // Stub canvas 2D context required by jsqr loop
    mockDrawImage = vi.fn();
    mockGetImageData = vi.fn((_sx?: number, _sy?: number, sw?: number, sh?: number) => {
      const w = sw ?? 640;
      const h = sh ?? 480;
      return {
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      };
    });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {
          drawImage: mockDrawImage,
          getImageData: mockGetImageData,
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    });

    mockLookupScan.mockResolvedValue({
      ok: true,
      data: {
        memberId: "m-123",
        memberName: "Alice Smith",
        regNumber: "RA261102600001",
        photoUrl: null,
        teamName: "Alpha",
        track: "Web",
        checkedIn: null,
      },
    });

    mockJsQR.mockReturnValue(null);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("initializes camera stream via getUserMedia on mount", async () => {
    await act(async () => {
      root.render(<CheckinScanner />);
    });

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.srcObject).toBe(fakeStream);
    expect(HTMLVideoElement.prototype.play).toHaveBeenCalled();
  });

  it("stops media tracks and clears video srcObject on unmount", async () => {
    await act(async () => {
      root.render(<CheckinScanner />);
    });

    const video = container.querySelector("video");
    expect(video?.srcObject).toBe(fakeStream);

    await act(async () => {
      root.unmount();
    });

    expect(stopTrackMock).toHaveBeenCalledTimes(2);
    expect(video?.srcObject).toBeNull();
  });

  it("stops every camera track and clears video srcObject when switching away to manual search", async () => {
    await act(async () => {
      root.render(<CheckinScanner />);
    });

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.srcObject).toBe(fakeStream);
    expect(stopTrackMock).not.toHaveBeenCalled();

    // User switches away from scanner view by clicking Manual Search tab
    const searchTabButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Manual Search"),
    );
    expect(searchTabButton).toBeDefined();

    await act(async () => {
      searchTabButton?.click();
    });

    // Every stream track must have stop() called
    expect(stopTrackMock).toHaveBeenCalledTimes(2);
    // video.srcObject must be cleared
    expect(video?.srcObject).toBeNull();
  });

  it("displays permission denied error when getUserMedia rejects with NotAllowedError", async () => {
    const permError = new Error("Camera permission denied");
    permError.name = "NotAllowedError";
    getUserMediaMock.mockRejectedValueOnce(permError);

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    expect(container.textContent).toContain("Camera access denied. Please grant camera permission or use manual search.");
  });

  it("displays generic error message when getUserMedia fails with unknown error", async () => {
    getUserMediaMock.mockRejectedValueOnce(new Error("Device busy"));

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    expect(container.textContent).toContain("Unable to access camera. Please use manual search below.");
  });

  it("draws frames to canvas, decodes via jsQR, and forwards payload to lookupScan", async () => {
    vi.useFakeTimers();

    const dummyToken = "A".repeat(40) + "b-_";
    const dummyPayload = `pandora-pass:${dummyToken}`;

    mockJsQR.mockReturnValue({ data: dummyPayload });

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    // Advance by one scanning interval (250ms)
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mockDrawImage).toHaveBeenCalled();
    expect(mockGetImageData).toHaveBeenCalled();
    expect(mockJsQR).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 640, 480, {
      inversionAttempts: "dontInvert",
    });
    expect(mockLookupScan).toHaveBeenCalledWith(dummyPayload);

    // Verified attendee card should be rendered
    expect(container.textContent).toContain("Alice Smith");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("RA261102600001");
  });

  it("enforces the 3-second debounce to prevent duplicate processing of the same payload", async () => {
    vi.useFakeTimers();

    const dummyToken = "A".repeat(40) + "b-_";
    const dummyPayload = `pandora-pass:${dummyToken}`;

    mockJsQR.mockReturnValue({ data: dummyPayload });
    // Use an error result so attendee details view does not replace the active scanning loop
    mockLookupScan.mockResolvedValue({
      ok: false,
      error: "Pass not found",
    });

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    // First scan tick at 250ms
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(mockLookupScan).toHaveBeenCalledTimes(1);

    // Second scan tick at 500ms (250ms later) with identical payload: debounce suppresses it
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(mockLookupScan).toHaveBeenCalledTimes(1);

    // Advance past 3000ms debounce window (e.g. 3000ms later)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockLookupScan).toHaveBeenCalledTimes(2);
  });

  it("downscales high-resolution camera frames to cap the long side at 640px while preserving aspect ratio", async () => {
    vi.useFakeTimers();

    // Configure a 1920x1080 (16:9) video stream
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { value: 1920, writable: true, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { value: 1080, writable: true, configurable: true });

    const dummyToken = "C".repeat(40) + "b-_";
    const dummyPayload = `pandora-pass:${dummyToken}`;
    mockJsQR.mockReturnValue({ data: dummyPayload });

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    // Advance by one scanning interval
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // 1920x1080 scaled by 640/1920 (1/3) results in 640x360 (exact 16:9 ratio, long side = 640px)
    expect(mockDrawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 0, 0, 640, 360);
    expect(mockGetImageData).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(mockJsQR).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 640, 360, {
      inversionAttempts: "dontInvert",
    });
    expect(mockLookupScan).toHaveBeenCalledWith(dummyPayload);

    // Reset back to 640x480 for subsequent tests
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { value: 640, writable: true, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { value: 480, writable: true, configurable: true });
  });

  it("blocks concurrent frame decoding while a lookupScan is in flight", async () => {
    vi.useFakeTimers();

    let resolveLookup!: (val: unknown) => void;
    mockLookupScan.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );

    const firstPayload = "pandora-pass:first123456789012345678901234567890123456";
    const secondPayload = "pandora-pass:second12345678901234567890123456789012345";

    mockJsQR.mockReturnValueOnce({ data: firstPayload });

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    // Trigger first lookup: tick 1 decodes firstPayload and calls lookupScan
    vi.advanceTimersByTime(250);
    expect(mockLookupScan).toHaveBeenCalledTimes(1);
    expect(mockLookupScan).toHaveBeenCalledWith(firstPayload);

    // Provide a different payload while first lookup is still pending.
    // Trigger another scan tick while lookupScan(firstPayload) remains in flight.
    mockJsQR.mockReturnValue({ data: secondPayload });
    vi.advanceTimersByTime(250);

    // The synchronous isProcessingRef guard MUST prevent second lookup from starting
    expect(mockLookupScan).toHaveBeenCalledTimes(1);
    expect(mockLookupScan).not.toHaveBeenCalledWith(secondPayload);

    // Resolve the first lookup and allow React to flush state updates
    await act(async () => {
      resolveLookup({
        ok: true,
        data: {
          memberId: "m-123",
          memberName: "Alice Smith",
          regNumber: "RA261102600001",
          photoUrl: null,
          teamName: "Alpha",
          track: "Web",
          checkedIn: null,
        },
      });
    });

    // Verify expected final state
    expect(container.textContent).toContain("Alice Smith");
    expect(mockLookupScan).toHaveBeenCalledTimes(1);
  });

  it("provides functional manual search fallback", async () => {
    mockSearchMembers.mockResolvedValue({
      ok: true,
      data: [
        {
          memberId: "m-999",
          memberName: "Bob Jones",
          regNumber: "RA261102600099",
          teamName: "Beta",
          hasPass: true,
          checkedInAt: null,
        },
      ],
    });

    await act(async () => {
      root.render(<CheckinScanner />);
    });

    // Click Manual Search tab
    const searchTabButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Manual Search"),
    );
    expect(searchTabButton).toBeDefined();

    await act(async () => {
      searchTabButton?.click();
    });

    const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeSetter?.call(searchInput, "Bob");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const searchForm = container.querySelector("form");
    await act(async () => {
      searchForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockSearchMembers).toHaveBeenCalledWith("Bob");

    // Bob Jones result should be displayed
    expect(container.textContent).toContain("Bob Jones");
    expect(container.textContent).toContain("RA261102600099");
    expect(container.textContent).toContain("Beta");
  });
});
