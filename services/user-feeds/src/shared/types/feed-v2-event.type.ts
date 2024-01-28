import { MediumPayload, mediumPayloadSchema } from "./medium-payload.type";
import { UserFeedDateCheckOptions } from "./user-feed-date-check-options.type";
import { UserFeedFormatOptions } from "./user-feed-format-options.type";
import { z } from "zod";

export interface FeedV2Event {
  timestamp: number;
  debug?: boolean;
  data: {
    feed: {
      id: string;
      url: string;
      passingComparisons: string[];
      blockingComparisons: string[];
      formatOptions?: UserFeedFormatOptions;
      dateChecks?: UserFeedDateCheckOptions;
    };
    mediums: MediumPayload[];
    articleDayLimit: number;
  };
}

export const feedV2EventSchemaFormatOptions = z.object({
  dateFormat: z.string().optional(),
  dateTimezone: z.string().optional(),
  dateLocale: z.string().optional(),
});

export const feedV2EventSchemaDateChecks = z.object({
  oldArticleDateDiffMsThreshold: z.number().optional(),
});

export const feedV2EventSchema = z.object({
  data: z.object({
    feed: z.object({
      id: z.string(),
      url: z.string(),
      passingComparisons: z.array(z.string()),
      blockingComparisons: z.array(z.string()),
      formatOptions: feedV2EventSchemaFormatOptions.optional(),
      dateChecks: feedV2EventSchemaDateChecks.optional(),
    }),
    mediums: z.array(mediumPayloadSchema).min(1),
    articleDayLimit: z.number(),
  }),
});
