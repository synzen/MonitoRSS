import { InferType, array, bool, number, object, string } from "yup";
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
  ownedByUser: bool().required(),
  refreshRateSeconds: number().optional(),
  connectionCount: number().required(),
  // Accepted co-managers on the feed. Surfaced so the personal->workspace
  // conversion flow can warn that feed sharing does not carry into a workspace.
  sharedManagers: array(
    object({
      discordUserId: string().required(),
      connectionScoped: bool().required(),
    }).required(),
  ).optional(),
});

export type UserFeedSummary = InferType<typeof UserFeedSummarySchema>;
