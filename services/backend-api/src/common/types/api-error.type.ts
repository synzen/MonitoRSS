import { ApiErrorCode } from "../constants/api-errors";

export interface ApiError {
  /**
   * High-level human-readable error message targeted at developers.
   */
  message: string;
  /**
   * Unique error code, language specific
   */
  code: ApiErrorCode;
}

export interface ApiErrorResponse {
  /**
   * High-level human-readable error message targeted at developers.
   */
  message: string;
  /**
   * Unique error code, language-agnostic.
   */
  code: ApiErrorCode;
  /**
   * Unix timestamp of when the error occurred.
   */
  timestamp: number;
  /**
   * List of detailed errors.
   */
  errors: ApiError[];
  /**
   * Used to distinguish between legacy/unformatted errors and this new format.
   */
  isStandardized: true;
}
