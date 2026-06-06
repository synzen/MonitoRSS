import { test as setup } from "@playwright/test";
import { writeFileSync } from "fs";
import { join } from "path";
import { startTunnel } from "../../helpers/tunnel";
import { updateNotificationUrl } from "../../helpers/paddle-api";
import { instanceSuffix } from "../../helpers/instance";

const REQUIRED_ENV_VARS = [
  "BACKEND_API_PADDLE_KEY",
  "BACKEND_API_PADDLE_URL",
  "E2E_PADDLE_NOTIFICATION_SETTING_ID",
] as const;

const BACKEND_PORT = parseInt(
  process.env.E2E_BACKEND_URL?.match(/:(\d+)/)?.[1] || "8000",
  10,
);
const WEBHOOK_PATH = "/api/v1/subscription-products/paddle-webhook";
const PADDLE_STATE_PATH = join(
  process.cwd(),
  `.paddle-state${instanceSuffix}.json`,
);

setup("start tunnel and configure Paddle", async () => {
  setup.setTimeout(120_000);

  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing env vars for Paddle tests: ${missing.join(", ")}. ` +
        "Add them to e2e/.env or export them in your shell.",
    );
  }

  const tunnelUrl = await startTunnel(BACKEND_PORT);
  await updateNotificationUrl(`${tunnelUrl}${WEBHOOK_PATH}`);

  writeFileSync(
    PADDLE_STATE_PATH,
    JSON.stringify({ tunnelUrl, cancelledIds: [] }, null, 2),
  );

  console.log("Paddle E2E setup complete");
});
