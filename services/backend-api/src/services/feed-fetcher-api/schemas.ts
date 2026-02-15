import { z } from "zod";
import { FeedFetcherFetchStatus } from "./types";

const FetchFeedResponseSuccessSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.Success),
  response: z.object({
    body: z.string(),
    statusCode: z.number(),
  }),
});

const FetchFeedResponseTooLargeSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.RefusedLargeFeed),
});

const FetchFeedResponsePendingSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.Pending),
});

const FetchFeedResponseBadStatusSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.BadStatusCode),
  response: z
    .object({
      statusCode: z.number(),
    })
    .optional(),
});

const FeedFetchResponseParseErrorSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.ParseError),
  response: z.object({
    statusCode: z.number(),
  }),
});

const FeedFetchResponseFetchTimeoutSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.FetchTimeout),
});

const FeedFetchResponseInvalidSslCertificateSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.InvalidSslCertificate),
});

const FeedFetchResponseFetchErrorSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.FetchError),
});

const FeedFetchResponseInternalErrorSchema = z.object({
  requestStatus: z.literal(FeedFetcherFetchStatus.InteralError),
});

export const FeedFetcherFetchFeedResponseSchema = z.discriminatedUnion(
  "requestStatus",
  [
    FetchFeedResponseSuccessSchema,
    FetchFeedResponseBadStatusSchema,
    FetchFeedResponsePendingSchema,
    FeedFetchResponseParseErrorSchema,
    FeedFetchResponseFetchTimeoutSchema,
    FetchFeedResponseTooLargeSchema,
    FeedFetchResponseInvalidSslCertificateSchema,
    FeedFetchResponseFetchErrorSchema,
    FeedFetchResponseInternalErrorSchema,
  ],
);
