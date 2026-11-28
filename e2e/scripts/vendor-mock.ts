import { teeConsoleToFile } from "../helpers/log-to-file";
import { VENDOR_MOCK_SERVER_PORT } from "../helpers/constants";

teeConsoleToFile("mock-vendor");

// The vendor doubles themselves live in the private package
// (@synzen/platform-adapters/mock-vendor); this script only mounts them. A
// package missing on an E2E_PLATFORM=1 run is a hard error, not a skip — the
// opt-in exists precisely to exercise the platform path.
try {
  const { startMockVendorServer } = require("@synzen/platform-adapters/mock-vendor") as {
    startMockVendorServer: (options: { port: number }) => Promise<unknown>;
  };
  startMockVendorServer({ port: VENDOR_MOCK_SERVER_PORT }).catch((err) => {
    console.error(`Vendor mock server failed to start: ${err?.message ?? err}`);
    process.exit(1);
  });
} catch (err) {
  console.error(
    "E2E_PLATFORM=1 needs @synzen/platform-adapters (mock-vendor export) resolvable from the e2e " +
      "workspace — npm-link a local build (re-link after any npm install) or install the published " +
      "version with GitHub Packages auth (see monitorss-platform-adapters README).",
  );
  throw err;
}
