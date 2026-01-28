import { z } from "zod";
import { GetArticlesResponseRequestStatus, TestDeliveryStatus } from "./types";

export const GetDeliveryCountResultSchema = z.object({
  result: z.object({
    count: z.number(),
  }),
});

export const SendTestArticleResultSchema = z.object({
  status: z.nativeEnum(TestDeliveryStatus),
  apiResponse: z.record(z.unknown()).optional(),
  apiPayload: z.record(z.unknown()).optional(),
});

export const CreatePreviewOutputSchema = z.object({
  status: z.nativeEnum(TestDeliveryStatus),
  messages: z
    .array(
      z.object({
        content: z.string().optional(),
        embeds: z.array(z.unknown()).optional(),
      }),
    )
    .optional(),
  customPlaceholderPreviews: z.array(z.array(z.string())),
});

const FilterStatusSchema = z.object({
  passed: z.boolean(),
});

const ResponseSchema = z.object({
  statusCode: z.number().optional(),
});

const ExternalContentErrorSchema = z.object({
  articleId: z.string(),
  sourceField: z.string(),
  label: z.string(),
  cssSelector: z.string(),
  errorType: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  pageHtml: z.string().optional(),
  pageHtmlTruncated: z.boolean().optional(),
});

const ResultSchema = z.object({
  requestStatus: z.nativeEnum(GetArticlesResponseRequestStatus),
  response: ResponseSchema.optional(),
  articles: z.array(z.record(z.string())),
  totalArticles: z.number().min(0),
  filterStatuses: z.array(FilterStatusSchema).optional(),
  selectedProperties: z.array(z.string()),
  url: z.string().optional(),
  attemptedToResolveFromHtml: z.boolean().optional(),
  feedTitle: z.string().nullable().optional(),
  externalContentErrors: z.array(ExternalContentErrorSchema).optional(),
});

export const GetArticlesResponseSchema = z.object({
  result: ResultSchema,
});

export const CreateFilterValidationResponseSchema = z.object({
  result: z.object({
    errors: z.array(z.string()),
  }),
});
