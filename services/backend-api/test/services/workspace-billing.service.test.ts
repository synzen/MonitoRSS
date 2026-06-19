import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  WorkspaceBillingService,
  type WorkspaceBillingServiceDeps,
} from "../../src/features/workspaces/workspace-billing.service";
import type { Config } from "../../src/config";
import { SubscriptionProductKey } from "../../src/repositories/shared/enums";
import type { IWorkspace } from "../../src/repositories/mongoose/workspace.mongoose.repository";
import { ConversionAlreadyInProgressException } from "../../src/shared/exceptions/workspace-billing.exceptions";

// Service-level unit tests for the conversion command's failure and timeout
// handling: these paths are impractical to exercise through the HTTP harness (a
// real poll timeout takes ~51s, and a mid-flight repository failure can't be
// injected end to end), so they are verified here with hand-built mock deps.
describe("WorkspaceBillingService.convertPersonalSubscriptionToWorkspace", () => {
  const workspaceId = "507f1f77bcf86cd799439011";
  const discordUserId = "discord-user-1";
  const subscriptionId = "sub-1";
  const feedIds = ["feed-1", "feed-2"];

  let calls: string[];
  let workspaceHasSubscription: boolean;

  function buildWorkspace(): IWorkspace {
    return { id: workspaceId, paddleCustomer: undefined } as IWorkspace;
  }

  function buildDeps(
    overrides: {
      reparentToWorkspace?: () => Promise<void>;
      patch?: () => Promise<void>;
      acquireGuard?: boolean;
    } = {},
  ): WorkspaceBillingServiceDeps {
    calls = [];
    workspaceHasSubscription = false;

    return {
      config: {
        BACKEND_API_ENABLE_SUPPORTERS: true,
        BACKEND_API_PADDLE_KEY: "key",
        BACKEND_API_PADDLE_URL: "https://paddle.test",
      } as Config,
      // Fast poll so a timeout resolves in milliseconds, not ~51s.
      pollOptions: { intervalMs: 1, maxTries: 2 },
      workspaceRepository: {
        findById: async () =>
          ({
            id: workspaceId,
            paddleCustomer: workspaceHasSubscription
              ? { subscription: { id: subscriptionId } }
              : undefined,
          }) as unknown as IWorkspace,
        setConversionInProgress: async () => {
          calls.push("setGuard");
          // true = this caller acquired the guard; false = a live guard was
          // already held by another in-flight conversion.
          return overrides.acquireGuard ?? true;
        },
        clearConversionInProgress: async () => {
          calls.push("clearGuard");
        },
      } as unknown as WorkspaceBillingServiceDeps["workspaceRepository"],
      paddleService: {
        updateSubscriptionCustomData:
          overrides.patch ??
          (async () => {
            calls.push("patch");
          }),
      } as unknown as WorkspaceBillingServiceDeps["paddleService"],
      supporterRepository: {
        findById: async () => ({
          paddleCustomer: {
            subscription: {
              id: subscriptionId,
              productKey: SubscriptionProductKey.Tier2,
              benefits: { maxUserFeeds: 70 },
            },
          },
        }),
      } as unknown as WorkspaceBillingServiceDeps["supporterRepository"],
      userFeedRepository: {
        areAllValidIds: () => true,
        findByIds: async () =>
          feedIds.map((id) => ({
            id,
            user: { discordUserId },
            workspaceId: null,
          })),
        reparentFeedsToWorkspace:
          overrides.reparentToWorkspace ??
          (async () => {
            calls.push("reparentToWorkspace");
          }),
        reparentFeedsToPersonal: async () => {
          calls.push("reparentToPersonal");
        },
      } as unknown as WorkspaceBillingServiceDeps["userFeedRepository"],
      feedCredentialsService: {
        syncLookupKeys: async () => {
          calls.push("syncLookupKeys");
        },
      } as unknown as WorkspaceBillingServiceDeps["feedCredentialsService"],
    };
  }

  beforeEach(() => {
    calls = [];
  });

  it("does not throw when the webhook is slow and the poll times out (still confirming)", async () => {
    const deps = buildDeps();
    const service = new WorkspaceBillingService(deps);

    // workspaceHasSubscription stays false, so the poll never sees the
    // subscription land and exhausts its tries.
    await assert.doesNotReject(
      service.convertPersonalSubscriptionToWorkspace(
        buildWorkspace(),
        discordUserId,
        feedIds,
      ),
      "a slow webhook (poll timeout) must surface as 'still confirming', not an error",
    );

    // The feeds stay parented to the workspace; no rollback on timeout.
    assert.ok(calls.includes("reparentToWorkspace"));
    assert.ok(calls.includes("patch"));
    assert.ok(!calls.includes("reparentToPersonal"));
  });

  it("unwinds the guard and the feeds when the reparent itself fails", async () => {
    const deps = buildDeps({
      reparentToWorkspace: async () => {
        calls.push("reparentToWorkspace");
        throw new Error("mongo write failed");
      },
    });
    const service = new WorkspaceBillingService(deps);

    await assert.rejects(
      service.convertPersonalSubscriptionToWorkspace(
        buildWorkspace(),
        discordUserId,
        feedIds,
      ),
    );

    // The guard must not be left set after a reparent failure.
    assert.ok(
      calls.includes("clearGuard"),
      "conversion guard must be cleared when the reparent fails",
    );
    // Paddle was never patched, so the user is financially whole.
    assert.ok(!calls.includes("patch"));
  });

  it("rejects a second concurrent conversion when the guard is already held", async () => {
    const deps = buildDeps({ acquireGuard: false });
    const service = new WorkspaceBillingService(deps);

    await assert.rejects(
      service.convertPersonalSubscriptionToWorkspace(
        buildWorkspace(),
        discordUserId,
        feedIds,
      ),
      (err) => err instanceof ConversionAlreadyInProgressException,
      "a concurrent conversion must be rejected, not run a duplicate move",
    );

    // It must not touch the feeds or Paddle when it loses the race.
    assert.ok(!calls.includes("reparentToWorkspace"));
    assert.ok(!calls.includes("patch"));
  });
});
