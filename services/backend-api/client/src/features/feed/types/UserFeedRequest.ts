import { InferType, number, object, string } from "yup";

export enum UserFeedRequestStatus {
  OK = "OK",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_STATUS_CODE = "BAD_STATUS_CODE",
  FETCH_ERROR = "FETCH_ERROR",
  FETCH_TIMEOUT = "FETCH_TIMEOUT",
  PARSE_ERROR = "PARSE_ERROR",
  TIMED_OUT = "TIMED_OUT",
  INVALID_SSL_CERTIFICATE = "INVALID_SSL_CERTIFICATE",
}

export const UserFeedRequestSchema = object({
  id: string().required(),
  url: string().required(),
  status: string().oneOf(Object.values(UserFeedRequestStatus)).required(),
  createdAt: number().required(),
  createdAtIso: string().required(),
  finishedAtIso: string().optional().nullable(),
  headers: object().nullable(),
  response: object({
    statusCode: number().nullable(),
    headers: object().nullable(),
  }).required(),
  freshnessLifetimeMs: number().nullable().optional(),
});

export type UserFeedRequest = InferType<typeof UserFeedRequestSchema>;
