import type { Config } from "../../config";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import type { PaddleService } from "../paddle/paddle.service";
import type { SupportersService } from "../supporters/supporters.service";
import type { UserFeedsService } from "../user-feeds/user-feeds.service";

export interface PaddleWebhooksServiceDeps {
  config: Config;
  paddleService: PaddleService;
  supportersService: SupportersService;
  userFeedsService: UserFeedsService;
  supporterRepository: ISupporterRepository;
  userRepository: IUserRepository;
}

export enum PaddleSubscriptionStatus {
  Active = "active",
  Cancelled = "canceled",
  PastDue = "past_due",
  Paused = "paused",
}

type DateString = string;

export interface PaddleEventSubscriptionUpdated {
  event_type: "subscription.updated";
  data: {
    id: string;
    status: PaddleSubscriptionStatus;
    customer_id: string;
    created_at: string;
    custom_data: {
      userId: string;
    };
    updated_at: string;
    items: Array<{
      quantity: number;
      price: {
        id: string;
        product_id: string;
      };
    }>;
    billing_cycle: {
      interval: "month" | "year";
      frequency: number;
    };
    currency_code: string;
    next_billed_at: DateString | null;
    scheduled_change: {
      action: "cancel";
      resume_at: string | null;
      effective_at: DateString;
    } | null;
    current_billing_period: {
      ends_at: DateString;
      starts_at: DateString;
    };
  };
}

export interface PaddleEventSubscriptionActivated {
  event_type: "subscription.activated";
  data: {
    id: string;
    status: PaddleSubscriptionStatus;
    customer_id: string;
    created_at: string;
    custom_data: {
      userId?: string;
    };
    updated_at: string;
    items: Array<{
      quantity: number;
      price: {
        id: string;
        product_id: string;
      };
    }>;
    billing_cycle: {
      interval: "month" | "year";
      frequency: number;
    };
    currency_code: string;
    next_billed_at: DateString | null;
    scheduled_change: null;
    current_billing_period: {
      ends_at: DateString;
      starts_at: DateString;
    };
  };
}

export interface PaddleEventSubscriptionCanceled {
  event_type: "subscription.canceled";
  data: {
    id: string;
    status: PaddleSubscriptionStatus.Cancelled;
    customer_id: string;
  };
}
