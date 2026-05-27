import { test as teardown } from "@playwright/test";
import { stopTunnel } from "../helpers/tunnel";
import { cancelAllActiveSubscriptions } from "../helpers/paddle-api";

teardown("cancel subscriptions and stop tunnel", async () => {
  teardown.setTimeout(120_000);

  try {
    await cancelAllActiveSubscriptions();
  } catch (err) {
    console.warn("Teardown subscription cleanup failed:", err);
  }

  await stopTunnel();

  console.log("Paddle E2E teardown complete");
});
