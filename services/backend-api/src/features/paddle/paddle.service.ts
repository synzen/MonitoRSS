import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { URLSearchParams } from "url";
import { SubscriptionProductKey } from "../supporter-subscriptions/constants/subscription-product-key.constants";
import { PaddleCustomerCreditBalanceResponse } from "../supporter-subscriptions/types/paddle-customer-credit-balance-response.type";
import { PaddleCustomerResponse } from "../supporter-subscriptions/types/paddle-customer-response.type";
import {
  PaddleProductResponse,
  PaddleProductsResponse,
} from "../supporter-subscriptions/types/paddle-products-response.type";
import { PaddleSubscriptionResponse } from "../supporter-subscriptions/types/paddle-subscription-response.type";
import { TransactionBalanceTooLowException } from "./exceptions/transaction-balance-too-low.exception";
import { CannotRenewSubscriptionBeforeRenewal } from "./exceptions/cannot-renew-subscription-before-renewal.exception";

@Injectable()
export class PaddleService {
  PADDLE_URL?: string;
  PADDLE_KEY?: string;
  PRODUCT_IDS: Array<{ id: string; name: string }> = [];

  constructor(private readonly configService: ConfigService) {
    this.PADDLE_URL = configService.get("BACKEND_API_PADDLE_URL");
    this.PADDLE_KEY = configService.get("BACKEND_API_PADDLE_KEY");
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
            .map((p) => ({
              id: p.id,
              customData: p.custom_data,
              billingCycle: p.billing_cycle,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let responseJson: any | null = null;
      let responseText = "";

      responseJson = (await res.json()) as Record<string, unknown>;
      responseText = JSON.stringify(responseJson);

      if (
        responseJson?.error?.code ===
        "subscription_update_transaction_balance_less_than_charge_limit"
      ) {
        throw new TransactionBalanceTooLowException();
      }

      if (responseJson?.error?.code === "subscription_locked_renewal") {
        throw new CannotRenewSubscriptionBeforeRenewal();
      }

      throw new Error(
        `Failed to make Paddle request (${url}) due to bad status code: ${res.status}. Response: ${responseText}`
      );
    }

    return (await res.json()) as T;
  }
}
