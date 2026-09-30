# jsQR

**What it is.** A pure-JavaScript QR code reading library that takes raw `ImageData` (`Uint8ClampedArray`) from a 2D canvas and locates and decodes QR codes without external dependencies, WebAssembly, or WebWorker files. The package is ~58 KB gzipped (~251 KB uncompressed).

**Why here.** The staff check-in portal (`apps/console/src/app/staff`) scans participant QR passes at the entrance. The initial implementation relied on the browser-native `window.BarcodeDetector` (Shape Detection API). However, Apple WebKit (Safari on iOS and iPadOS) has never implemented the Shape Detection API, causing automatic camera scanning to fail completely on all iOS devices. `jsqr` runs in any browser with HTML5 Canvas support, restoring camera-based scanning for staff on iPhones and iPads as well as Android Chrome and desktop browsers over HTTPS.

**Trade-offs and limitations.**
- **Maintenance status:** `jsQR` has not had a release since 2021 (v1.4.0).
- **Execution model:** Runs synchronously on the main JavaScript thread; decoding runs within the throttled interval tick rather than a background WebWorker.
- **Recognition robustness:** Can be slower and less resilient on severely blurred, angled, or glare-heavy QR codes compared to ZXing or the native hardware-accelerated `BarcodeDetector` API.

**Instead of.**
- **Native `BarcodeDetector` only:** Fast and hardware-accelerated on Chromium/Android, but completely unsupported on iOS Safari.
- **Native `BarcodeDetector` first, with `jsQR` as fallback:** A hybrid path was considered where Chromium browsers use the native detector and Safari falls back to `jsQR`. A single `jsQR` path was adopted initially for consistent cross-browser behavior, simplified debugging, and uniform error states; adding the native detector as a primary fast-path remains a viable optimization if higher scan frame rates are required.
- **`qr-scanner` (Nimiq):** Wraps a WebWorker, but requires serving an external worker script (`qr-scanner-worker.min.js`) or bundler worker loaders, introducing asset resolution complexity under OpenNext on Cloudflare Workers.
- **`html5-qrcode` / `@zxing/browser`:** Significantly larger bundle footprint (~180–350 KB), though more resilient on low-quality camera frames.

**In this repo.** Used in `apps/console/src/features/checkin/scanner.tsx` (`CheckinScanner`) to decode QR frames from an in-memory `<canvas>` drawn from the camera `<video>` stream. The decoded text is forwarded to `handleProcessPayload` and verified by `lookupScan`.

**Read next.** https://github.com/cozmo/jsQR
