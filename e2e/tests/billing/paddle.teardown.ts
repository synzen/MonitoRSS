import { test as teardown } from "@playwright/test";
import { stopTunnel } from "../../helpers/tunnel";
import {
  cancelActiveSubscriptionsForEmail,
  setNotificationTrafficSource,
} from "../../helpers/paddle-api";
import { MOCK_USER_EMAIL } from "../../helpers/mock-discord-data";

teardown("cancel subscriptions and stop tunnel", async () => {
  teardown.setTimeout(120_000);

  // Scope cleanup to the mock test user's Paddle customer, NOT every active
  // subscription in the sandbox. The sandbox is one shared account, so an
  // account-wide cancel also kills a developer's dev-stack subscription (and any
  // parallel run's) that happens to be active at the same time. The suite only
  // ever creates subscriptions for this user, so this cancels exactly its own.
  try {
    await cancelActiveSubscriptionsForEmail(MOCK_USER_EMAIL);
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
