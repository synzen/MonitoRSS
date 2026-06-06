import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { PaddleService } from "../../src/services/paddle/paddle.service";
import {
  AddressLocationNotAllowedException,
  CannotRenewSubscriptionBeforeRenewal,
  SubscriptionAlreadyCancelledException,
  TransactionBalanceTooLowException,
} from "../../src/shared/exceptions/paddle.exceptions";
import type { Config } from "../../src/config";

describe("PaddleService", () => {
  const config = {
    BACKEND_API_PADDLE_URL: "https://sandbox-api.paddle.com",
    BACKEND_API_PADDLE_KEY: "test-key",
  } as Config;

  const originalFetch = global.fetch;

  const stubFetch = (status: number, body: Record<string, unknown>) => {
    global.fetch = (async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
      }) as unknown as Response) as typeof fetch;
  };

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("executeApiCall error mapping", () => {
    it("maps subscription_update_when_canceled to SubscriptionAlreadyCancelledException", async () => {
      stubFetch(400, {
        error: {
          type: "request_error",
          code: "subscription_update_when_canceled",
          detail: "cannot update subscription, as subscription is canceled",
        },
      });

      const service = new PaddleService(config);

      await assert.rejects(
        service.executeApiCall("/subscriptions/sub_123/cancel", {
          method: "POST",
        }),
        SubscriptionAlreadyCancelledException,
      );
    });

    it("maps subscription_update_transaction_balance_less_than_charge_limit to TransactionBalanceTooLowException", async () => {
      stubFetch(400, {
        error: {
          code: "subscription_update_transaction_balance_less_than_charge_limit",
        },
      });

      const service = new PaddleService(config);

      await assert.rejects(
        service.executeApiCall("/subscriptions/sub_123/update", {
          method: "PATCH",
        }),
        TransactionBalanceTooLowException,
      );
    });

    it("maps subscription_locked_renewal to CannotRenewSubscriptionBeforeRenewal", async () => {
      stubFetch(400, {
        error: { code: "subscription_locked_renewal" },
      });

      const service = new PaddleService(config);

      await assert.rejects(
        service.executeApiCall("/subscriptions/sub_123/update", {
          method: "PATCH",
        }),
        CannotRenewSubscriptionBeforeRenewal,
      );
    });

    it("maps address_location_not_allowed to AddressLocationNotAllowedException", async () => {
      stubFetch(400, {
        error: { code: "address_location_not_allowed" },
      });

      const service = new PaddleService(config);

      await assert.rejects(
        service.executeApiCall("/subscriptions/sub_123/update", {
          method: "PATCH",
        }),
        AddressLocationNotAllowedException,
      );
    });

    it("throws a generic error for unrecognized error codes", async () => {
      stubFetch(400, {
        error: { code: "some_unknown_paddle_error" },
      });

      const service = new PaddleService(config);

      await assert.rejects(
        service.executeApiCall("/subscriptions/sub_123/cancel", {
          method: "POST",
        }),
        (err: Error) =>
          err.constructor === Error &&
          err.message.includes("due to bad status code: 400"),
      );
    });
  });
});
