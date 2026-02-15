export enum SubscriptionProductKey {
  Free = "free",
  Tier1 = "tier1",
  Tier2 = "tier2",
  Tier3 = "tier3",
  Tier3AdditionalFeed = "t3feed",
}

interface PaddleCreditBalance {
  currency_code: string;
  balance: {
    available: string;
    reserved: string;
    used: string;
  };
}

export interface PaddleCustomerCreditBalanceResponse {
  data: Array<PaddleCreditBalance>;
}

interface PaddleCustomer {
  id: string;
  email: string;
}

export interface PaddleCustomerResponse {
  data: PaddleCustomer;
}

interface PaddleProductPrice {
  id: string;
  status: "active" | "archived";
  billing_cycle: {
    frequency: number;
    interval: "day" | "week" | "month" | "year";
  } | null;
  custom_data?: {
    key?: string;
  } | null;
}

export interface PaddleProduct {
  id: string;
  name: string;
  prices: PaddleProductPrice[];
  custom_data?: {
    key?: string;
  };
}

export interface PaddleProductsResponse {
  data: Array<PaddleProduct>;
}

export interface PaddleProductResponse {
  data: PaddleProduct;
}

export interface PaddleSubscriptionResponse {
  data: {
    management_urls: {
      update_payment_method?: string | null;
    };
  };
}

export interface PaddlePricingPreviewResponse {
  data: {
    currency_code: string;
    details: {
      line_items: Array<{
        price: {
          id: string;
          billing_cycle?: {
            frequency: number;
            interval: "month" | "year";
          } | null;
        };
        formatted_totals: {
          total: string;
        };
        product: {
          id: string;
          custom_data?: {
            key?: string;
          } | null;
        };
      }>;
    };
  };
}
