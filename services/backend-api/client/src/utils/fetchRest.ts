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
      // eslint-disable-next-line no-console
      console.error(url, yupErr.errors);
      throw new ApiAdapterError("API contract violation detected. Try again later.");
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
  } catch (err) {
    const errorMessage = getStatusCodeErrorMessage(res.status);

    throw new ApiAdapterError(errorMessage, {
      statusCode: res.status,
    });
  }

  if (json.isStandardized) {
    throw new ApiAdapterError(getStandardErrorCodeMessage(json.code), {
      statusCode: res.status,
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
};

export default fetchRest;
