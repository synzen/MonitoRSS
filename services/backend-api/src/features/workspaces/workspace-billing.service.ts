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
import { SubscriptionAlreadyCancelledException } from "../../shared/exceptions/paddle.exceptions";
import { WorkspaceNotSubscribedException } from "../../shared/exceptions/user-feeds.exceptions";
import {
  InvalidWorkspaceTierException,
  WorkspaceBillingNotConfiguredException,
} from "../../shared/exceptions/workspace-billing.exceptions";
import {
  isBillingEnabled,
  WORKSPACE_BASE_TIER_KEYS,
  WORKSPACE_PRODUCT_KEYS,
} from "../../shared/utils/billing";
import { pollUntil } from "../../shared/utils/poll-until";
import { formatCurrency } from "../../utils/format-currency";

export interface WorkspaceBillingServiceDeps {
  config: Config;
  workspaceRepository: WorkspaceMongooseRepository;
  paddleService: PaddleService;
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
    );
  }
}
