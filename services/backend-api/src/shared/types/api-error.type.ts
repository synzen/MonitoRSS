import type { ApiErrorCode } from "../constants/api-errors";

export interface ApiError {
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  code: ApiErrorCode;
  timestamp: number;
  errors: ApiError[];
  isStandardized: true;
}
