"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  confirmCheckIn,
  lookupScan,
  searchMembers,
  type AttendeeDetails,
  type CheckInResult,
  type SearchMemberResult,
} from "./actions";

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (opts: { formats: string[] }) => BarcodeDetectorInstance;

function formatIstTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function CheckinScanner() {
  const [activeTab, setActiveTab] = useState<"scan" | "search">("scan");

  // Camera & Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcodeSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return "BarcodeDetector" in window;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const lastScannedPayloadRef = useRef<{ payload: string; timestamp: number } | null>(null);

  // Scanned / Selected attendee
  const [attendee, setAttendee] = useState<AttendeeDetails | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] = useState<
    | { status: "success"; timeStr: string }
    | { status: "already"; message: string }
    | { status: "error"; message: string }
    | null
  >(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMemberResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [isPendingCheckIn, startCheckInTransition] = useTransition();

  // Process a scanned or submitted pass payload
  const handleProcessPayload = useCallback(async (payload: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    setScanError(null);
    setCheckInResult(null);

    try {
      const res = await lookupScan(payload);
      if (res.ok) {
        setAttendee(res.data);
        if (res.data.checkedIn) {
          const timeStr = formatIstTime(new Date(res.data.checkedIn.at));
          setCheckInResult({
            status: "already",
            message: `Already checked in at ${timeStr} by ${res.data.checkedIn.byName}.`,
          });
        }
      } else {
        setScanError(res.error);
      }
    } catch {
      setScanError("Failed to lookup pass. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  // Manage Camera stream
  useEffect(() => {
    if (activeTab !== "scan" || attendee !== null) {
      // Stop camera if not in scanner view or when reviewing an attendee
      return;
    }

    const videoEl = videoRef.current;
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function startCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera API is not supported on this browser.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          if (videoEl) {
            videoEl.srcObject = null;
          }
          return;
        }

        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play();
          setCameraActive(true);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (videoEl) {
            videoEl.srcObject = null;
          }
          setCameraActive(false);
          const errorMsg =
            err instanceof Error && err.name === "NotAllowedError"
              ? "Camera access denied. Please grant camera permission or use manual search."
              : "Unable to access camera. Please use manual search below.";
          setCameraError(errorMsg);
        }
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [activeTab, attendee]);

  // QR Scanning Loop using BarcodeDetector
  useEffect(() => {
    if (!cameraActive || isProcessing || attendee !== null || !barcodeSupported) {
      return;
    }

    let active = true;
    let detector: BarcodeDetectorInstance | null = null;

    try {
      const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (BarcodeDetectorClass) {
        detector = new BarcodeDetectorClass({ formats: ["qr_code"] });
      }
    } catch {
      return;
    }

    if (!detector) return;

    const intervalId = setInterval(async () => {
      if (!active || isProcessingRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      try {
        const barcodes = await detector?.detect(videoRef.current);
        if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue && active) {
          const rawValue = barcodes[0].rawValue;
          const now = Date.now();
          if (
            lastScannedPayloadRef.current &&
            lastScannedPayloadRef.current.payload === rawValue &&
            now - lastScannedPayloadRef.current.timestamp < 3000
          ) {
            return;
          }
          if (isProcessingRef.current) {
            return;
          }
          lastScannedPayloadRef.current = { payload: rawValue, timestamp: now };
          handleProcessPayload(rawValue);
        }
      } catch {
        // Frame detection error, ignore and continue next interval
      }
    }, 250);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [cameraActive, isProcessing, attendee, barcodeSupported, handleProcessPayload]);

  // Perform check-in
  const handleConfirmCheckIn = () => {
    if (!attendee || isPendingCheckIn) return;

    startCheckInTransition(async () => {
      try {
        const res: CheckInResult = await confirmCheckIn(attendee.memberId);
        if (res.ok) {
          const timeStr = formatIstTime(new Date(res.at));
          setCheckInResult({
            status: "success",
            timeStr,
          });
        } else if (res.already) {
          setCheckInResult({
            status: "already",
            message: res.error,
          });
        } else {
          setCheckInResult({
            status: "error",
            message: res.error,
          });
        }
      } catch {
        setCheckInResult({
          status: "error",
          message: "Check-in request failed. Please check network connection.",
        });
      }
    });
  };

  // Reset to scan next attendee
  const handleScanNext = () => {
    isProcessingRef.current = false;
    lastScannedPayloadRef.current = null;
    setAttendee(null);
    setScanError(null);
    setCheckInResult(null);
    setIsProcessing(false);
  };

  // Search handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await searchMembers(searchQuery);
      if (res.ok) {
        setSearchResults(res.data);
      } else {
        setSearchError(res.error);
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Check in directly from search result
  const handleSearchMemberSelect = (member: SearchMemberResult) => {
    if (!member.hasPass) {
      setSearchError("No pass has been issued for this attendee.");
      return;
    }

    setAttendee({
      memberId: member.memberId,
      memberName: member.memberName,
      regNumber: member.regNumber,
      photoUrl: null,
      teamName: member.teamName,
      track: "Participant",
      checkedIn: member.checkedInAt
        ? { at: member.checkedInAt, byName: "Staff" }
        : null,
    });
    if (member.checkedInAt) {
      setCheckInResult({
        status: "already",
        message: `Already checked in at ${formatIstTime(new Date(member.checkedInAt))}.`,
      });
    } else {
      setCheckInResult(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
        maxWidth: "480px",
      }}
    >
      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          borderRadius: "var(--radius-element, 0.5rem)",
          backgroundColor: "var(--color-neutral, #f3f4f6)",
          padding: "0.25rem",
          gap: "0.25rem",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab("scan");
            handleScanNext();
          }}
          style={{
            flex: 1,
            padding: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            borderRadius: "var(--radius-element, 0.375rem)",
            border: "none",
            backgroundColor: activeTab === "scan" ? "#ffffff" : "transparent",
            color: activeTab === "scan" ? "#111827" : "#4b5563",
            boxShadow: activeTab === "scan" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            cursor: "pointer",
          }}
        >
          📷 Camera Scanner
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("search");
            handleScanNext();
          }}
          style={{
            flex: 1,
            padding: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            borderRadius: "var(--radius-element, 0.375rem)",
            border: "none",
            backgroundColor: activeTab === "search" ? "#ffffff" : "transparent",
            color: activeTab === "search" ? "#111827" : "#4b5563",
            boxShadow: activeTab === "search" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            cursor: "pointer",
          }}
        >
          🔍 Manual Search
        </button>
      </div>

      {/* SCANNER VIEW */}
      {activeTab === "scan" && !attendee && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "1rem",
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-container, 0.75rem)",
            border: "1px solid var(--color-border, #e5e5e5)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              backgroundColor: "#18181b",
              borderRadius: "0.5rem",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: cameraActive ? "block" : "none",
              }}
            />

            {!cameraActive && (
              <div
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.875rem",
                  textAlign: "center",
                  padding: "1rem",
                }}
              >
                {cameraError ? cameraError : "Starting camera..."}
              </div>
            )}

            {/* Target Reticle */}
            {cameraActive && (
              <div
                style={{
                  position: "absolute",
                  width: "180px",
                  height: "180px",
                  border: "2px solid #3b82f6",
                  borderRadius: "0.75rem",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {!barcodeSupported && (
            <div
              style={{
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#fef3c7",
                color: "#92400e",
                fontSize: "0.75rem",
                lineHeight: 1.4,
              }}
            >
              ⚠️ Automatic QR detection is not supported on this browser profile. Use the manual search
              tab or enter the pass payload below.
            </div>
          )}

          {scanError && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              {scanError}
            </div>
          )}

          {isProcessing && (
            <div
              style={{
                padding: "0.5rem",
                textAlign: "center",
                fontSize: "0.875rem",
                color: "#2563eb",
                fontWeight: 500,
              }}
            >
              Verifying pass...
            </div>
          )}
        </div>
      )}

      {/* MANUAL SEARCH VIEW */}
      {activeTab === "search" && !attendee && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "1rem",
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-container, 0.75rem)",
            border: "1px solid var(--color-border, #e5e5e5)",
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, reg number, or team..."
              style={{
                flex: 1,
                padding: "0.625rem 0.75rem",
                fontSize: "0.875rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                border: "1px solid var(--color-border, #d1d5db)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                cursor: isSearching ? "not-allowed" : "pointer",
                opacity: isSearching || !searchQuery.trim() ? 0.7 : 1,
              }}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchError && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "var(--radius-element, 0.375rem)",
                fontSize: "0.8125rem",
              }}
            >
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>
                Matching Attendees ({searchResults.length})
              </span>
              {searchResults.map((member) => (
                <div
                  key={member.memberId}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "var(--radius-element, 0.375rem)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>
                      {member.memberName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {member.regNumber} • {member.teamName}
                    </div>
                  </div>

                  <div>
                    {member.checkedInAt ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#16a34a",
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#dcfce7",
                          borderRadius: "9999px",
                        }}
                      >
                        Present
                      </span>
                    ) : !member.hasPass ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: "#9a3412",
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#ffedd5",
                          borderRadius: "9999px",
                        }}
                      >
                        No Pass
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSearchMemberSelect(member)}
                        style={{
                          padding: "0.375rem 0.75rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: "#2563eb",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "var(--radius-element, 0.25rem)",
                          cursor: "pointer",
                        }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ATTENDEE VERIFICATION CARD */}
      {attendee && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-container, 0.75rem)",
            border: "1px solid var(--color-border, #e5e5e5)",
          }}
        >
          {/* Header info */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {attendee.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={attendee.photoUrl}
                alt={attendee.memberName}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #e5e7eb",
                }}
              />
            ) : (
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "#f3f4f6",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                }}
              >
                {attendee.memberName.charAt(0) || "P"}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {attendee.memberName}
              </h3>
              <div style={{ fontSize: "0.8125rem", color: "#4b5563", marginTop: "0.125rem" }}>
                {attendee.regNumber}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.125rem" }}>
                {attendee.teamName} • <span style={{ fontWeight: 600 }}>{attendee.track}</span>
              </div>
            </div>
          </div>

          {/* STATUS NOTICES */}
          {checkInResult?.status === "success" && (
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#dcfce7",
                color: "#15803d",
                fontSize: "0.875rem",
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div>✅ Marked Present!</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 400 }}>
                Check-in recorded at {checkInResult.timeStr} IST.
              </div>
            </div>
          )}

          {checkInResult?.status === "already" && (
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#fef3c7",
                color: "#b45309",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {checkInResult.message}
            </div>
          )}

          {checkInResult?.status === "error" && (
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "var(--radius-element, 0.375rem)",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              ❌ {checkInResult.message}
            </div>
          )}

          {/* ACTIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
            {!checkInResult || (checkInResult.status !== "success" && checkInResult.status !== "already") ? (
              <button
                type="button"
                onClick={handleConfirmCheckIn}
                disabled={isPendingCheckIn}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-element, 0.5rem)",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  cursor: isPendingCheckIn ? "not-allowed" : "pointer",
                  opacity: isPendingCheckIn ? 0.7 : 1,
                  boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
                }}
              >
                {isPendingCheckIn ? "Marking Present..." : "Mark Present"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleScanNext}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "var(--radius-element, 0.5rem)",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                cursor: "pointer",
              }}
            >
              Scan Next Attendee →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
