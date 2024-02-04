/* eslint-disable no-console */
import { Schema, ValidationError } from "yup";
import ApiAdapterError from "./ApiAdapterError";
import { getStandardErrorCodeMessage } from "./getStandardErrorCodeMessage copy";
import getStatusCodeErrorMessage from "./getStatusCodeErrorMessage";

interface StandardApiError {
  /**
   * High-level human-readable error message targeted at developers.
   */
  message: string;
  /**
   * Unique error code, language specific
   */
  code: string;
}

interface StandardApiErrorResponse {
  /**
   * High-level human-readable error message targeted at developers.
   */
  message: string;
  /**
   * Unique error code, language-agnostic.
   */
  code: string;
  /**
   * Unix timestamp of when the error occurred.
   */
  timestamp: number;
  /**
   * List of detailed errors.
   */
  errors: StandardApiError[];
  /**
   * Used to distinguish between legacy/unformatted errors and this new format.
   */
  isStandardized: true;
}

interface FetchOptions<T> {
  requestOptions?: RequestInit;
  validateSchema?: Schema<T>;
  skipJsonParse?: boolean;
}

const fetchRest = async <T>(url: string, fetchOptions?: FetchOptions<T>): Promise<T | Response> => {
  const headers = determineHeaders(fetchOptions?.requestOptions);
  const res = await fetch(url, {
    ...fetchOptions?.requestOptions,
    headers,
  });

  await handleStatusCode(res);
  let json: any;

  if (!fetchOptions?.skipJsonParse && res.status !== 204) {
    json = await res.json();
  }

  if (json && fetchOptions?.validateSchema) {
    try {
      const validationResult = await fetchOptions.validateSchema.validate(json, {
        strict: true,
        abortEarly: false,
      });

      return validationResult;
    } catch (err) {
      const yupErr = err as ValidationError;

      try {
        const errorReportRes = await fetch("/api/v1/error-reports", {
          method: "POST",
          body: JSON.stringify({
            message: `Frontend contract violation`,
            errors: yupErr.errors,
            url,
            jsonResponse: json,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!errorReportRes.ok) {
          throw new Error(`Bad status code: ${res.status}`);
        }
      } catch (reportErr) {
        console.error("Error reporting api contract validation failed", reportErr);
      }

      // eslint-disable-next-line no-console
      console.error(url, yupErr.errors);
      throw new ApiAdapterError(
        "Sorry, there was an internal error (API contract violation). Try again later."
      );
    }
  }

  if (json) {
    return json;
  }

  return res;
};

const determineHeaders = (requestOptions?: RequestInit) => {
  const headers: RequestInit["headers"] = {};

  if (["POST", "PUT", "PATCH", "GET"].includes(requestOptions?.method?.toUpperCase() || "")) {
    headers["Content-Type"] = "application/json";
  }

  return {
    ...headers,
    ...requestOptions?.headers,
  };
};

const handleStatusCode = async (res: Response) => {
  if (res.ok) {
    return res;
  }

  let json: Record<string, any> | StandardApiErrorResponse;

  try {
    json = await res.json();

    if (json.isStandardized) {
      // console.log("is standard", getStandardErrorCodeMessage(json.code));
      throw new ApiAdapterError(getStandardErrorCodeMessage(json.code), {
        statusCode: res.status,
        errorCode: json.code,
      });
    } else if (res.status === 400) {
      // Legacy error formatting
      throw new ApiAdapterError(json.message || "Unknown error", {
        statusCode: res.status,
      });
    } else {
      throw new ApiAdapterError(getStatusCodeErrorMessage(res.status), {
        statusCode: res.status,
      });
    }
  } catch (err) {
    if (err instanceof ApiAdapterError) {
      throw err;
    }

    const errorMessage = getStatusCodeErrorMessage(res.status);

    throw new ApiAdapterError(errorMessage, {
      statusCode: res.status,
    });
  }
};

export default fetchRest;
