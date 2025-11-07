import { InferType, object, string } from "yup";

export enum SendTestArticleDeliveryStatus {
  Success = "SUCCESS",
  ThirdPartyInternalError = "THIRD_PARTY_INTERNAL_ERROR",
  BadPayload = "BAD_PAYLOAD",
  MissingApplicationPermission = "MISSING_APPLICATION_PERMISSION",
  MissingChannel = "MISSING_CHANNEL",
  TooManyRequests = "TOO_MANY_REQUESTS",
  NoArticles = "NO_ARTICLES",
}

export enum SendTestArticleOperationType {
  CreateThreadOnMessage = "CREATE_THREAD_ON_MESSAGE",
}

export const SendTestArticleResultSchema = object({
  status: string().oneOf(Object.values(SendTestArticleDeliveryStatus)).required(),
  apiResponse: object().optional().default(undefined),
  apiPayload: object().optional().default(undefined),
  operationType: string()
    .oneOf(Object.values(SendTestArticleOperationType))
    .optional()
    .default(undefined),
}).required();

export type SendTestArticleResult = InferType<typeof SendTestArticleResultSchema>;
