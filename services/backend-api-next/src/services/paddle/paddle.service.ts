import type { Config } from "../../config";
import {
  TransactionBalanceTooLowException,
  CannotRenewSubscriptionBeforeRenewal,
  AddressLocationNotAllowedException,
} from "../../shared/exceptions/paddle.exceptions";
import type {
  SubscriptionProductKey,
  PaddleCustomerCreditBalanceResponse,
  PaddleCustomerResponse,
  PaddleProductsResponse,
  PaddleProductResponse,
  PaddleSubscriptionResponse,
} from "./types";

export class PaddleService {
  private readonly PADDLE_URL?: string;
  private readonly PADDLE_KEY?: string;

  constructor(private readonly config: Config) {
    this.PADDLE_URL = config.BACKEND_API_PADDLE_URL;
    this.PADDLE_KEY = config.BACKEND_API_PADDLE_KEY;
  }

  async getCustomerCreditBalanace(customerId: string) {
    const response =
      await this.executeApiCall<PaddleCustomerCreditBalanceResponse>(
        `/customers/${customerId}/credit-balances`
      );

    return response;
  }

  async getProducts() {
    const searchParams = new URLSearchParams({
      status: "active",
      include: "prices",
    });

    const response = await this.executeApiCall<PaddleProductsResponse>(
      `/products?${searchParams.toString()}`
    );

    return {
      products: response.data
        .filter((p) => !!p.custom_data?.key)
        .map((p) => ({
          id: p.custom_data?.key as string,
          name: p.name,
          prices: p.prices
            .filter((s) => s.status === "active")
            .map((price) => ({
              id: price.id,
              customData: price.custom_data,
              billingCycle: price.billing_cycle,
            })),
          customData: p.custom_data,
        })),
    };
  }

  async getProduct(productId: string) {
    const response = await this.executeApiCall<PaddleProductResponse>(
      `/products/${productId}`
    );

    if (!response.data.custom_data?.key) {
      throw new Error(
        `Paddle Product ${productId} does not have a custom_data.key set`
      );
    }

    return {
      paddleProductId: response.data.id,
      id: response.data.custom_data?.key as SubscriptionProductKey | undefined,
    };
  }

  async getCustomer(id: string) {
    const response = await this.executeApiCall<PaddleCustomerResponse>(
      `/customers/${id}`
    );

    return {
      email: response.data.email,
    };
  }

  async updateCustomer(id: string, data: { email: string }) {
    await this.executeApiCall(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getSubscription(subscriptionId: string) {
    return this.executeApiCall<PaddleSubscriptionResponse>(
      `/subscriptions/${subscriptionId}`
    );
  }

  async executeApiCall<T>(endpoint: string, data?: RequestInit): Promise<T> {
    if (!this.PADDLE_KEY || !this.PADDLE_URL) {
      throw new Error(
        "Paddle key or paddle URL not set when executing api request to paddle products"
      );
    }

    const url = `${this.PADDLE_URL}${endpoint}`;

    const res = await fetch(url, {
      ...data,
      headers: {
        ...data?.headers,
        Authorization: `Bearer ${this.PADDLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      let responseJson: Record<string, unknown> | null = null;
      let responseText = "";

      try {
        responseJson = (await res.json()) as Record<string, unknown>;
        responseText = JSON.stringify(responseJson);
      } catch {
        responseText = await res.text().catch(() => "Unable to read response");
        throw new Error(
          `Failed to make Paddle request (${url}): ${res.status}. Response: ${responseText}`
        );
      }

      if (
        (responseJson?.error as Record<string, unknown>)?.code ===
        "subscription_update_transaction_balance_less_than_charge_limit"
      ) {
        throw new TransactionBalanceTooLowException();
      }

      if (
        (responseJson?.error as Record<string, unknown>)?.code ===
        "subscription_locked_renewal"
      ) {
        throw new CannotRenewSubscriptionBeforeRenewal();
      }

      if (
        (responseJson?.error as Record<string, unknown>)?.code ===
        "address_location_not_allowed"
      ) {
        throw new AddressLocationNotAllowedException();
      }

      throw new Error(
        `Failed to make Paddle request (${url}) due to bad status code: ${res.status}. Response: ${responseText}`
      );
    }

    return (await res.json()) as T;
  }
}
