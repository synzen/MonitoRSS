import { array, bool, InferType, number, object, string } from "yup";
import { FeedConnectionSchema } from "../../../types";
import { UserFeedDisabledCode } from "./UserFeedDisabledCode";
import { UserFeedHealthStatus } from "./UserFeedHealthStatus";
import { UserFeedManagerInviteType, UserFeedManagerStatus } from "../../../constants";

export const UserFeedSchema = object({
  id: string().required(),
  allowLegacyReversion: bool(),
  title: string().required(),
  url: string().required(),
  sharedAccessDetails: object({
    inviteId: string().required(),
  }).optional(),
  passingComparisons: array(string().required()).optional().default(undefined),
  blockingComparisons: array(string().required()).optional().default(undefined),
  createdAt: string()
    .transform((value) => (value ? new Date(value).toISOString() : value))
    .required(),
  updatedAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  disabledCode: string().oneOf(Object.values(UserFeedDisabledCode)).optional(),
  healthStatus: string().oneOf(Object.values(UserFeedHealthStatus)).required(),
  connections: array(FeedConnectionSchema).required(),
  refreshRateSeconds: number().required(),
  userRefreshRateSeconds: number(),
  formatOptions: object({
    dateFormat: string().optional().default(undefined),
    dateTimezone: string().optional().default(undefined),
  })
    .optional()
    .notRequired()
    .default(null),
  dateCheckOptions: object({
    oldArticleDateDiffMsThreshold: number().optional().default(undefined),
  }).optional(),
  isLegacyFeed: bool(),
  shareManageOptions: object({
    invites: array(
      object({
        id: string().required(),
        discordUserId: string().required(),
        type: string().oneOf(Object.values(UserFeedManagerInviteType)).optional(),
        status: string().oneOf(Object.values(UserFeedManagerStatus)).optional().nullable(),
        createdAt: string()
          .transform((value) => (value ? new Date(value).toISOString() : value))
          .required(),
      }).required()
    ).required(),
  })
    .optional()
    .nullable()
    .default(undefined),
});

export type UserFeed = InferType<typeof UserFeedSchema>;
