import type { Config } from "../../config";
import { SubscriptionProductKey } from "../../repositories/shared/enums";
import type {
  IWorkspace,
  WorkspaceMongooseRepository,
} from "../../repositories/mongoose/workspace.mongoose.repository";
import type { IPaddleCustomerSubscription } from "../../repositories/interfaces/supporter.types";
import type { PaddleService } from "../../services/paddle/paddle.service";
import type {
  PaddleSubscriptionPreviewResponse,
} from "../../services/supporter-subscriptions/types";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { FeedCredentialsService } from "../../services/feed-credentials/feed-credentials.service";
import { SubscriptionAlreadyCancelledException } from "../../shared/exceptions/paddle.exceptions";
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
  isBillingEnabled,
  resolvePersonalConvertibility,
  WORKSPACE_BASE_TIER_KEYS,
  WORKSPACE_PRODUCT_KEYS,
} from "../../shared/utils/billing";
import { pollUntil } from "../../shared/utils/poll-until";
import { formatCurrency } from "../../utils/format-currency";

export interface WorkspaceBillingServiceDeps {
  config: Config;
  workspaceRepository: WorkspaceMongooseRepository;
  paddleService: PaddleService;
  supporterRepository: ISupporterRepository;
  userFeedRepository: IUserFeedRepository;
  feedCredentialsService: FeedCredentialsService;
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
    await this.assertWorkspacePrices(items);

    const response =
      await this.deps.paddleService.updateSubscriptionItems<PaddleSubscriptionPreviewResponse>(
        subscription.id,
        { items, currencyCode: subscription.currencyCode, preview: true },
      );

    const immediateTransaction = response.data.immediate_transaction;

    if (!immediateTransaction) {
      throw new Error(
        "Failed to get immediate transaction from workspace subscription preview response",
      );
    }

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
    };
  }

  async changeSubscription(
    workspace: IWorkspace,
    items: Array<{ priceId: string; quantity: number }>,
  ): Promise<void> {
    const subscription = this.getSubscriptionOrThrow(workspace);
    await this.assertWorkspacePrices(items);

    await this.deps.paddleService.updateSubscriptionItems(subscription.id, {
      items,
      currencyCode: subscription.currencyCode,
    });

    const currentUpdatedAt = subscription.updatedAt.getTime();

    await this.pollForSubscriptionChange(workspace.id, (sub) => {
      const latestUpdatedAt = sub?.updatedAt;

      return !!latestUpdatedAt && latestUpdatedAt.getTime() > currentUpdatedAt;
    });
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

    await this.pollForSubscriptionChange(
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

    await this.pollForSubscriptionChange(
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

    const supporter = await this.deps.supporterRepository.findById(discordUserId);
    const personalSubscription = supporter?.paddleCustomer?.subscription;
    const convertible = resolvePersonalConvertibility(personalSubscription);

    if (!personalSubscription || !convertible) {
      throw new PersonalSubscriptionNotConvertibleException(
        "A Tier 2 or Tier 3 personal subscription is required to convert",
      );
    }

    await this.assertConvertibleFeedSelection(
      discordUserId,
      feedIds,
      convertible.feedLimit,
    );

    // Guard first, atomically: while it is set, workspace feed-limit
    // enforcement skips its disable step, so the feeds can't be flicked off in
    // the window between the re-parent and the subscription record appearing.
    // The compare-and-set also serializes conversions — a second concurrent
    // attempt can't acquire a live guard and is rejected before touching any
    // feeds or Paddle (so it can't run a duplicate move or clear the in-flight
    // conversion's guard in the catch below).
    const acquired = await this.deps.workspaceRepository.setConversionInProgress(
      workspace.id,
      CONVERSION_GUARD_TTL_MS,
    );

    if (!acquired) {
      throw new ConversionAlreadyInProgressException(
        `A conversion is already in progress for workspace ${workspace.id}`,
      );
    }

    try {
      await this.deps.userFeedRepository.reparentFeedsToWorkspace(
        feedIds,
        workspace.id,
      );

      // The scope flip changes which credential backs each feed, so the lookup
      // key (which routes a feed to the credentialed vs plain-URL delivery
      // loop) must be reconciled against the new scope. Without this a moved
      // Reddit feed keeps its personal-scope key, is excluded from the
      // plain-URL loop, resolves no workspace credential in the credentialed
      // loop, and is silently fetched by neither.
      await this.deps.feedCredentialsService.syncLookupKeys({ feedIds });

      await this.deps.paddleService.updateSubscriptionCustomData(
        personalSubscription.id,
        { workspaceId: workspace.id },
      );
    } catch (err) {
      // Anything up to and including the Paddle patch failing means no
      // workspace subscription record was ever written (the webhook never
      // fires) and the user is financially whole. Unwind every local write —
      // return the feeds to personal, reconcile their lookup keys back, and
      // clear the guard — then surface the failure.
      await this.deps.userFeedRepository.reparentFeedsToPersonal(feedIds);
      await this.deps.feedCredentialsService.syncLookupKeys({ feedIds });
      await this.deps.workspaceRepository.clearConversionInProgress(
        workspace.id,
      );

      throw err;
    }

    // The patch succeeded; the re-emitted webhook records the subscription and
    // clears the guard. If it is delayed past the poll timeout the feeds stay
    // parented (the guard's TTL bounds the exposure) and the caller surfaces a
    // "still confirming" state rather than rolling back — so a slow webhook
    // must not error out a conversion that has, in fact, succeeded.
    try {
      await this.pollForSubscriptionChange(workspace.id, (sub) => !!sub);
    } catch {
      // Timed out waiting for the webhook; the conversion is committed and
      // will reconcile when it lands. The client polls the workspace detail
      // for the recorded subscription and shows a confirming state meanwhile.
    }
  }

  private async assertConvertibleFeedSelection(
    discordUserId: string,
    feedIds: string[],
    maxFeeds: number,
  ): Promise<void> {
    if (!this.deps.userFeedRepository.areAllValidIds(feedIds)) {
      throw new InvalidConversionFeedSelectionException(
        "One or more selected feeds are not valid feeds",
      );
    }

    if (feedIds.length > maxFeeds) {
      throw new InvalidConversionFeedSelectionException(
        `Cannot move ${feedIds.length} feeds; the plan allows ${maxFeeds}`,
      );
    }

    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);

    const allOwnedAndPersonal =
      feeds.length === feedIds.length &&
      feeds.every(
        (feed) =>
          feed.user.discordUserId === discordUserId && !feed.workspaceId,
      );

    if (!allOwnedAndPersonal) {
      throw new InvalidConversionFeedSelectionException(
        "Selected feeds must all be your own personal feeds",
      );
    }
  }

  // Workspace deletion must never leave a live Paddle subscription behind.
  // No-op when billing is not configured or the workspace has no
  // subscription; an already-cancelled subscription is fine; any other Paddle
  // failure propagates so the deletion is aborted.
  async cancelSubscriptionOnDeletion(workspace: IWorkspace): Promise<void> {
    const subscription = workspace.paddleCustomer?.subscription;

    if (!isBillingEnabled(this.deps.config) || !subscription) {
      return;
    }

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
        return;
      }

      throw err;
    }
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
  ): Promise<void> {
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
      WORKSPACE_BASE_TIER_KEYS.has(
        productKeyByPriceId.get(item.priceId) ?? "",
      ),
    );

    if (!hasBaseTier) {
      throw new InvalidWorkspaceTierException(
        "Workspace subscription changes must include a base workspace tier",
      );
    }
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
}
