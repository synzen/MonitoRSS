import { MediumPayload, mediumPayloadSchema } from "./medium-payload.type";
import { UserFeedDateCheckOptions } from "./user-feed-date-check-options.type";
import { UserFeedFormatOptions } from "./user-feed-format-options.type";
import { z } from "zod";
import {
  ExternalFeedProperty,
  externalFeedPropertySchema,
} from "../../article-parser/constants";
import { FeedRequestLookupDetails } from "./feed-request-lookup-details.type";

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
      externalProperties?: ExternalFeedProperty[];
      requestLookupDetails?: FeedRequestLookupDetails;
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

export const feedV2EventRequestLookupDetails = z.object({
  key: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
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
      externalProperties: z.array(externalFeedPropertySchema).optional(),
      requestLookupDetails: feedV2EventRequestLookupDetails.optional(),
    }),
    mediums: z.array(mediumPayloadSchema).min(1),
    articleDayLimit: z.number(),
  }),
});
