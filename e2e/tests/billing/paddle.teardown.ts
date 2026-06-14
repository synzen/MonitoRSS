import { test as teardown } from "@playwright/test";
import { stopTunnel } from "../../helpers/tunnel";
import {
  cancelAllActiveSubscriptions,
  setNotificationTrafficSource,
} from "../../helpers/paddle-api";

teardown("cancel subscriptions and stop tunnel", async () => {
  teardown.setTimeout(120_000);

  try {
    await cancelAllActiveSubscriptions();
  } catch (err) {
    console.warn("Teardown subscription cleanup failed:", err);
  }

  // Undo the run-wide "all" traffic source from setup (matters only for a
  // bring-your-own setting; ephemeral settings are deleted right after).
  try {
    await setNotificationTrafficSource("platform");
  } catch (err) {
    console.warn("Teardown traffic source reset failed:", err);
  }

  await stopTunnel();

  console.log("Paddle E2E teardown complete");
});
