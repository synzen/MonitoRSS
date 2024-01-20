import { InferType, object, string } from "yup";

export enum UserFeedDeliveryLogStatus {
  DELIVERED = "DELIVERED",
  PENDING_DELIVERY = "PENDING_DELIVERY",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
  FILTERED_OUT = "FILTERED_OUT",
  MEDIUM_RATE_LIMITED = "MEDIUM_RATE_LIMITED",
  ARTICLE_RATE_LIMITED = "ARTICLE_RATE_LIMITED",
  PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED",
}

export const UserFeedDeliveryLogSchema = object({
  id: string().required(),
  status: string().oneOf(Object.values(UserFeedDeliveryLogStatus)).required(),
  mediumId: string().required(),
  articleIdHash: string().required(),
  createdAt: string().required(),
  details: object({
    message: string(),
    data: object().optional(),
  }).optional(),
});

export type UserFeedDeliveryLog = InferType<typeof UserFeedDeliveryLogSchema>;
