# qrcode

**What it is.** A widely-used, pure-JavaScript QR code generation library for Node.js and the browser with no native C++ or canvas dependencies.

**Why here.** Pandora displays a personal check-in QR pass on the participant dashboard once a team is shortlisted. Generating a vector SVG string directly on the server enables Next.js server components to embed the QR code into initial HTML with zero client-side JavaScript, zero canvas dependencies, and crisp scaling at any display density.

**Instead of.**
- Client-side canvas/SVG libraries (`qrcode.react`, `react-qr-code`): requires client components, React hydration, and extra bundle weight in the browser.
- Native canvas-backed server generation (`canvas` / `node-canvas`): requires C++ system libraries and native toolchains that complicate CI and serverless deployments on Vercel.
- External QR image generation APIs: introduces third-party network latency, failure points, and exposes private token payloads over external HTTP requests.

**In this repo.** Used in `apps/web/src/features/checkin/pass-card.tsx` via `QRCode.toString(payload, { type: "svg" })` inside the `<CheckinPassCard>` server component.

**Read next.** https://github.com/soldair/node-qrcode
