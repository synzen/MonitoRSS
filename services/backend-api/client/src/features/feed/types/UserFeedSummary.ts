import { InferType, bool, number, object, string } from "yup";
import { UserFeedDisabledCode } from "./UserFeedDisabledCode";
import { UserFeedHealthStatus } from "./UserFeedHealthStatus";
import { UserFeedComputedStatus } from "./UserFeedComputedStatus";

export const UserFeedSummarySchema = object({
  id: string().required(),
  title: string().required(),
  url: string().required(),
  inputUrl: string(),
  createdAt: string()
    .transform((value) => (value ? new Date(value).toISOString() : value))
    .required(),
  disabledCode: string().oneOf(Object.values(UserFeedDisabledCode)).optional(),
  healthStatus: string().oneOf(Object.values(UserFeedHealthStatus)).required(),
  computedStatus: string().oneOf(Object.values(UserFeedComputedStatus)).required(),
  isLegacyFeed: bool().required(),
  ownedByUser: bool().required(),
  refreshRateSeconds: number().optional(),
});

export type UserFeedSummary = InferType<typeof UserFeedSummarySchema>;
