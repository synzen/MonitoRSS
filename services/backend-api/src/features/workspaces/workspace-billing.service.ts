import type { Config } from "../../config";
import { SubscriptionStatus } from "../../repositories/shared/enums";
import type {
  IWorkspace,
  WorkspaceMongooseRepository,
} from "../../repositories/mongoose/workspace.mongoose.repository";
import type { IPaddleCustomerSubscription } from "../../repositories/interfaces/supporter.types";
import type { PaddleService } from "../../services/paddle/paddle.service";
import type { PaddleSubscriptionPreviewResponse } from "../../services/supporter-subscriptions/types";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { PersonalFeedMovesService } from "../personal-feed-moves/personal-feed-moves.service";
import type { PersonalFeedMoveReceipt } from "../../repositories/interfaces/user-feed.types";
import {
  PersonalFeedMoveCapacityExceededError,
  PersonalFeedMoveInvalidSelectionError,
  PersonalFeedMoveWorkspaceNotFoundError,
} from "../../repositories/interfaces/user-feed.types";
import {
  SubscriptionAlreadyCancelledException,
  TransactionBalanceTooLowException,
} from "../../shared/exceptions/paddle.exceptions";
import { WorkspaceNotSubscribedException } from "../../shared/exceptions/user-feeds.exceptions";
import {
  ConversionAlreadyInProgressException,
  InvalidConversionFeedSelectionException,
  InvalidWorkspaceTierException,
  PersonalSubscriptionNotConvertibleException,
  WorkspaceAlreadySubscribedException,
  WorkspaceBillingNotConfiguredException,
} from "../../shared/exceptions/workspace-billing.exceptions";
import {
  CONVERSION_GUARD_TTL_MS,
  DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
  isBillingEnabled,
  resolvePersonalConvertibility,
  resolveWorkspaceFeedLimit,
  WORKSPACE_BASE_TIER_KEYS,
  WORKSPACE_PRODUCT_KEYS,
} from "../../shared/utils/billing";
import { pollUntil, PollTimeoutException } from "../../shared/utils/poll-until";
import { formatCurrency } from "../../shared/utils/format-currency";

export interface WorkspaceBillingServiceDeps {
  config: Config;
  workspaceRepository: WorkspaceMongooseRepository;
  paddleService: PaddleService;
  supporterRepository: ISupporterRepository;
  userFeedRepository: IUserFeedRepository;
  personalFeedMovesService: PersonalFeedMovesService;
  // Test seam: shrinks the local poll interval/tries so timeout paths can be
  // exercised without the production ~51s wait. Defaults to production timing.
  pollOptions?: { intervalMs?: number; maxTries?: number };
}

export interface SubscriptionChangePreview {
  immediateTransaction: {
    billingPeriod: {
      startsAt: string;
      endsAt: string;
    };
    subtotal: string;
    subtotalFormatted: string;
    tax: string;
    taxFormatted: string;
    credit: string;
    creditFormatted: string;
    total: string;
    totalFormatted: string;
    grandTotal: string;
    grandTotalFormatted: string;
  } | null;
  deferred?: boolean;
  nextBillDate?: string | null;
  // Projected effect of the change on the workspace's feeds. A downgrade that
  // drops below the workspace's current active feed count disables the overflow
  // (feeds are disabled, never deleted), so the confirmation screen can warn
  // before the owner commits. Includes enough identity data to render a reviewable
  // affected-feeds list in oldest-first order.
  feedImpact: {
    newFeedLimit: number;
    currentFeedCount: number;
    willBeDisabledCount: number;
    affectedFeeds: Array<{
      id: string;
      title: string;
      url: string;
      createdAt: string;
    }>;
  };
}

// Workspace counterpart of the personal supporter-subscriptions service:
// mutations go to the Paddle API keyed by the workspace's own subscription,
// then poll the local workspace record until the webhook reflects the change
// (the webhook handler is the single writer of subscription state).
export class WorkspaceBillingService {
  constructor(private readonly deps: WorkspaceBillingServiceDeps) {}

  async previewChange(
    workspace: IWorkspace,
    items: Array<{ priceId: string; quantity: number }>,
  ): Promise<SubscriptionChangePreview> {
    const subscription = this.getSubscriptionOrThrow(workspace);
    const productKeyByPriceId = await this.assertWorkspacePrices(items);

    const resolvedItems = items.map((item) => ({
      productKey: productKeyByPriceId.get(item.priceId) ?? "",
      quantity: item.quantity,
    }));

    const feedImpactPromise = this.computeFeedImpact(workspace.id, resolvedItems);

    let response: PaddleSubscriptionPreviewResponse | null = null;
    let deferred = false;

    try {
      response =
        await this.deps.paddleService.updateSubscriptionItems<PaddleSubscriptionPreviewResponse>(
          subscription.id,
          { items, currencyCode: subscription.currencyCode, preview: true },
        );
    } catch (err) {
      if (err instanceof TransactionBalanceTooLowException) {
        deferred = true;
      } else {
        throw err;
      }
    }

    const feedImpact = await feedImpactPromise;

    if (deferred || !response?.data.immediate_transaction) {
      // Below Paddle's charge limit: billing deferred to renewal, capacity granted immediately via courtesy extension
      return {
        immediateTransaction: null,
        deferred: true,
        nextBillDate: subscription.nextBillDate
          ? subscription.nextBillDate.toISOString()
          : null,
        feedImpact,
      };
    }

    const immediateTransaction = response.data.immediate_transaction;
    const currencyCode = subscription.currencyCode;

    return {
      immediateTransaction: {
        billingPeriod: {
          startsAt: immediateTransaction.billing_period.starts_at,
          endsAt: immediateTransaction.billing_period.ends_at,
        },
        subtotal: immediateTransaction.details.totals.subtotal,
        subtotalFormatted: formatCurrency(
          immediateTransaction.details.totals.subtotal,
          currencyCode,
        ),
        tax: immediateTransaction.details.totals.tax,
        taxFormatted: formatCurrency(
          immediateTransaction.details.totals.tax,
          currencyCode,
        ),
        credit: immediateTransaction.details.totals.credit,
        creditFormatted: formatCurrency(
          immediateTransaction.details.totals.credit,
          currencyCode,
        ),
        total: immediateTransaction.details.totals.total,
        totalFormatted: formatCurrency(
          immediateTransaction.details.totals.total,
          currencyCode,
        ),
        grandTotal: immediateTransaction.details.totals.grand_total,
        grandTotalFormatted: formatCurrency(
          immediateTransaction.details.totals.grand_total,
          currencyCode,
        ),
      },
      deferred: false,
      nextBillDate: subscription.nextBillDate
        ? subscription.nextBillDate.toISOString()
        : null,
      feedImpact,
    };
  }

  // How many of the workspace's active feeds the previewed item set would push
  // over the new limit. The count uses the same slot-occupying exclusion set as
  // limit enforcement so an already over-limit workspace isn't double-counted,
  // and the projected limit comes from the shared resolver the webhook also
  // uses, so the preview and the eventual activation agree. Also returns the
  // oldest-first list of affected feeds for the review view.
  private async computeFeedImpact(
    workspaceId: string,
    items: Array<{ productKey: string; quantity: number }>,
  ): Promise<SubscriptionChangePreview["feedImpact"]> {
    const newFeedLimit = resolveWorkspaceFeedLimit(items);

    if (newFeedLimit == null) {
      throw new Error(
        "Could not resolve a workspace feed limit for the previewed items; " +
          "WORKSPACE_BASE_TIER_KEYS and WORKSPACE_TIER_FEED_LIMITS may have drifted",
      );
    }

    const currentFeedCount =
      await this.deps.userFeedRepository.countByWorkspaceExcludingDisabled(
        workspaceId,
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
      );

    const willBeDisabledCount = Math.max(0, currentFeedCount - newFeedLimit);

    let affectedFeeds: SubscriptionChangePreview["feedImpact"]["affectedFeeds"] = [];

    if (willBeDisabledCount > 0) {
      try {
        const feeds = await this.deps.userFeedRepository.findOldestWorkspaceFeeds(
          workspaceId,
          willBeDisabledCount,
          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
        );

        affectedFeeds = feeds.map((f) => ({
          id: f.id,
          title: f.title,
          url: f.url,
          createdAt: f.createdAt.toISOString(),
        }));
      } catch {
        affectedFeeds = [];
      }
    }

    return {
      newFeedLimit,
      currentFeedCount,
      willBeDisabledCount,
      affectedFeeds,
    };
  }

  async changeSubscription(
    workspace: IWorkspace,
    items: Array<{ priceId: string; quantity: number }>,
  ): Promise<{ deferred?: boolean; nextBillDate?: string | null }> {
    const subscription = this.getSubscriptionOrThrow(workspace);
    const productKeyByPriceId = await this.assertWorkspacePrices(items);

    const resolvedLimit = resolveWorkspaceFeedLimit(
      items.map((item) => ({
        productKey: productKeyByPriceId.get(item.priceId) ?? "",
        quantity: item.quantity,
      })),
    );

    try {
      await this.deps.paddleService.updateSubscriptionItems(subscription.id, {
        items,
        currencyCode: subscription.currencyCode,
      });
    } catch (err) {
      if (err instanceof TransactionBalanceTooLowException) {
        // Below Paddle's immediate charge limit: schedule for renewal and grant capacity immediately
        await this.deps.paddleService.updateSubscriptionItems(subscription.id, {
          items,
          currencyCode: subscription.currencyCode,
          prorationBillingMode: "prorated_next_billing_period",
        });

        if (resolvedLimit != null) {
          // Grant expires at next bill date + 2 days grace (covers webhook latency)
          const nextBill = subscription.nextBillDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const expiresAt = new Date(nextBill.getTime() + 2 * 24 * 60 * 60 * 1000);

          await this.deps.workspaceRepository.setPendingCapacityGrant(workspace.id, {
            feeds: resolvedLimit,
            grantedAt: new Date(),
            expiresAt,
            nextBillDate: subscription.nextBillDate ?? null,
          });
        }

        return {
          deferred: true,
          nextBillDate: subscription.nextBillDate ? subscription.nextBillDate.toISOString() : null,
        };
      }

      throw err;
    }

    // Clear any prior pending grant when an immediate charge succeeded — it is now authoritative
    if (workspace.pendingCapacityGrant) {
      await this.deps.workspaceRepository.clearPendingCapacityGrant(workspace.id);
    }

    const currentUpdatedAt = subscription.updatedAt.getTime();

    await this.pollForSubscriptionChange(workspace.id, (sub) => {
      const latestUpdatedAt = sub?.updatedAt;

      return !!latestUpdatedAt && latestUpdatedAt.getTime() > currentUpdatedAt;
    });

    return { deferred: false };
  }

  // Returns a Paddle update-payment-method transaction for the workspace's own
  // subscription. Reuses getSubscriptionOrThrow, so a dormant workspace maps to
  // a structured 4xx (not a 500). Updating the card flips no subscription
  // field, so there is nothing to poll for.
  async getUpdatePaymentMethodTransaction(
    workspace: IWorkspace,
  ): Promise<{ id: string }> {
    const subscription = this.getSubscriptionOrThrow(workspace);

    return this.deps.paddleService.getUpdatePaymentMethodTransaction(
      subscription.id,
    );
  }

  async cancelSubscription(workspace: IWorkspace): Promise<void> {
    const subscription = this.getSubscriptionOrThrow(workspace);

    try {
      await this.deps.paddleService.executeApiCall(
        `/subscriptions/${subscription.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ effective_from: "next_billing_period" }),
        },
      );
    } catch (err) {
      if (err instanceof SubscriptionAlreadyCancelledException) {
        await this.deps.workspaceRepository.nullifySubscriptionBySubscriptionId(
          subscription.id,
        );

        return;
      }

      throw err;
    }

    // Paddle has accepted the cancellation at this point; the poll only waits for
    // the webhook to write it locally. Treating that wait as failure would tell
    // the caller the cancellation did not happen when it did, inviting a retry
    // against an already-cancelled subscription. The webhook remains the single
    // writer and lands on its own, so a timeout here is eventual consistency.
    await this.pollForSubscriptionChangeAllowingTimeout(
      workspace.id,
      (sub) => !!sub?.cancellationDate,
    );
  }

  async resumeSubscription(workspace: IWorkspace): Promise<void> {
    const subscription = this.getSubscriptionOrThrow(workspace);

    await this.deps.paddleService.executeApiCall(
      `/subscriptions/${subscription.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ scheduled_change: null }),
      },
    );

    // As with cancellation, Paddle has already cleared the scheduled change; the
    // poll only confirms the webhook's local write, so a timeout is eventual
    // consistency rather than a failed resume.
    await this.pollForSubscriptionChangeAllowingTimeout(
      workspace.id,
      (sub) => !sub?.cancellationDate,
    );
  }

  // Converts the caller's personal subscription into this workspace, bringing
  // the selected personal feeds along. The webhook stays the single writer of
  // subscription state: this re-points the Paddle subscription's custom_data to
  // the workspace and polls until the re-emitted webhook records it.
  async convertPersonalSubscriptionToWorkspace(
    workspace: IWorkspace,
    discordUserId: string,
    feedIds: string[],
  ): Promise<void> {
    if (!isBillingEnabled(this.deps.config)) {
      throw new WorkspaceBillingNotConfiguredException(
        "Workspace billing requires Paddle to be configured",
      );
    }

    if (workspace.paddleCustomer?.subscription) {
      throw new WorkspaceAlreadySubscribedException(
        `Workspace ${workspace.id} already has a subscription`,
      );
    }

    const supporter =
      await this.deps.supporterRepository.findById(discordUserId);
    const personalSubscription = supporter?.paddleCustomer?.subscription;
    const convertible = resolvePersonalConvertibility(personalSubscription);

    if (!personalSubscription || !convertible) {
      throw new PersonalSubscriptionNotConvertibleException(
        "A Tier 2 or Tier 3 personal subscription is required to convert",
      );
    }

    // Guard first, atomically: while it is set, workspace feed-limit
    // enforcement skips its disable step, so the feeds can't be flicked off in
    // the window between the re-parent and the subscription record appearing.
    // The compare-and-set also serializes conversions — a second concurrent
    // attempt can't acquire a live guard and is rejected before touching any
    // feeds or Paddle (so it can't run a duplicate move or clear the in-flight
    // conversion's guard in the catch below).
    const acquired =
      await this.deps.workspaceRepository.setConversionInProgress(
        workspace.id,
        CONVERSION_GUARD_TTL_MS,
      );

    if (!acquired) {
      throw new ConversionAlreadyInProgressException(
        `A conversion is already in progress for workspace ${workspace.id}`,
      );
    }

    let moveReceipt: PersonalFeedMoveReceipt | undefined;

    try {
      moveReceipt = await this.deps.personalFeedMovesService.moveToWorkspace({
        discordUserId,
        feedIds,
        workspaceId: workspace.id,
        maxWorkspaceFeeds: convertible.feedLimit,
      });

      await this.deps.paddleService.updateSubscriptionCustomData(
        personalSubscription.id,
        { workspaceId: workspace.id },
      );
    } catch (err) {
      try {
        if (moveReceipt) {
          await this.deps.personalFeedMovesService.rollback(moveReceipt);
        }
      } finally {
        await this.deps.workspaceRepository.clearConversionInProgress(
          workspace.id,
        );
      }

      if (
        err instanceof PersonalFeedMoveInvalidSelectionError ||
        err instanceof PersonalFeedMoveCapacityExceededError ||
        err instanceof PersonalFeedMoveWorkspaceNotFoundError
      ) {
        throw new InvalidConversionFeedSelectionException(err.message);
      }

      throw err;
    }

    // The patch succeeded; the re-emitted webhook records the subscription and
    // clears the guard. If it is delayed past the poll timeout the feeds stay
    // parented (the guard's TTL bounds the exposure) and the caller surfaces a
    // "still confirming" state rather than rolling back — so a slow webhook
    // must not error out a conversion that has, in fact, succeeded.
    // Timing out waiting for the webhook is fine: the conversion is committed and
    // reconciles when it lands, and the client polls the workspace detail for the
    // recorded subscription and shows a confirming state meanwhile.
    await this.pollForSubscriptionChangeAllowingTimeout(
      workspace.id,
      (sub) => !!sub,
    );
  }

  // A subscription whose billing relationship is still live blocks deletion:
  // the owner must cancel it first. A subscription already scheduled to cancel
  // (cancellationDate set) no longer blocks, since the owner has committed to
  // ending it; a fully cancelled subscription is nullified off the workspace by
  // the webhook, so it never reaches here. Status other than Cancelled (active,
  // past due, paused) all represent live billing and block.
  hasBlockingSubscription(workspace: IWorkspace): boolean {
    const subscription = workspace.paddleCustomer?.subscription;

    if (!isBillingEnabled(this.deps.config) || !subscription) {
      return false;
    }

    return (
      subscription.status !== SubscriptionStatus.Cancelled &&
      !subscription.cancellationDate
    );
  }

  private getSubscriptionOrThrow(
    workspace: IWorkspace,
  ): IPaddleCustomerSubscription {
    if (!isBillingEnabled(this.deps.config)) {
      throw new WorkspaceBillingNotConfiguredException(
        "Workspace billing requires Paddle to be configured",
      );
    }

    const subscription = workspace.paddleCustomer?.subscription;

    if (!subscription) {
      // Reachable by any owner (e.g. a stale Billing page on a dormant
      // workspace), so it must map to a structured 4xx, not a 500.
      throw new WorkspaceNotSubscribedException(
        `No existing subscription found for workspace ${workspace.id}`,
      );
    }

    return subscription;
  }

  // Rejects prices that do not belong to workspace-capable products
  // (Tier 1 / Free are personal-only).
  private async assertWorkspacePrices(
    items: Array<{ priceId: string; quantity: number }>,
  ): Promise<Map<string, string>> {
    const { products } = await this.deps.paddleService.getProducts();

    const productKeyByPriceId = new Map<string, string>();

    for (const product of products) {
      for (const price of product.prices) {
        productKeyByPriceId.set(price.id, product.id);
      }
    }

    for (const item of items) {
      const productKey = productKeyByPriceId.get(item.priceId);

      if (!productKey || !WORKSPACE_PRODUCT_KEYS.has(productKey)) {
        throw new InvalidWorkspaceTierException(
          `Price ${item.priceId} does not belong to a workspace-capable product`,
        );
      }
    }

    // Paddle replaces the subscription's item set with whatever is sent, so
    // an add-on-only array would silently drop the base plan.
    const hasBaseTier = items.some((item) =>
      WORKSPACE_BASE_TIER_KEYS.has(productKeyByPriceId.get(item.priceId) ?? ""),
    );

    if (!hasBaseTier) {
      throw new InvalidWorkspaceTierException(
        "Workspace subscription changes must include a base workspace tier",
      );
    }

    return productKeyByPriceId;
  }

  private async pollForSubscriptionChange(
    workspaceId: string,
    check: (subscription: IPaddleCustomerSubscription | null) => boolean,
  ): Promise<void> {
    await pollUntil(
      async () => {
        const workspace =
          await this.deps.workspaceRepository.findById(workspaceId);

        return workspace?.paddleCustomer?.subscription ?? null;
      },
      check,
      `workspace ${workspaceId} subscription change`,
      this.deps.pollOptions,
    );
  }

  // For mutations Paddle has already accepted, where the poll is only a
  // read-back of the webhook's local write. The change is committed regardless,
  // so a timeout must not surface as a failed operation; the webhook lands on
  // its own and the client's refetch picks it up. Only the timeout is absorbed:
  // a repository or connection failure still propagates.
  private async pollForSubscriptionChangeAllowingTimeout(
    workspaceId: string,
    check: (subscription: IPaddleCustomerSubscription | null) => boolean,
  ): Promise<void> {
    try {
      await this.pollForSubscriptionChange(workspaceId, check);
    } catch (err) {
      if (err instanceof PollTimeoutException) {
        return;
      }

      throw err;
    }
  }
}
