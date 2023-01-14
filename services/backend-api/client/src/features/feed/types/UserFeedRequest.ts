import { InferType, number, object, string } from "yup";

export enum UserFeedRequestStatus {
  OK = "OK",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_STATUS_CODE = "BAD_STATUS_CODE",
  FETCH_ERROR = "FETCH_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
}

export const UserFeedRequestSchema = object({
  id: number().required(),
  status: string().oneOf(Object.values(UserFeedRequestStatus)).required(),
  createdAt: number().required(),
});

export type UserFeedRequest = InferType<typeof UserFeedRequestSchema>;
