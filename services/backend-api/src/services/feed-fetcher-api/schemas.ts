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

export const ClassifyUrlsResponseSchema = z.object({
  // Boolean per input URL, aligned by index: whether feed-requests classifies
  // the URL as a platform (premium) destination URL.
  results: z.array(z.boolean()),
});

export const ResolveUrlsResponseSchema = z.object({
  // Canonical destination URL per input URL, aligned by index; null when the
  // URL is non-platform or has no provider equivalent (caller keeps the raw
  // input there).
  results: z.array(z.string().nullable()),
});
