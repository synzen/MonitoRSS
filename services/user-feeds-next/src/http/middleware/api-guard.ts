/**
 * API key authentication middleware for Bun.serve()
 */

import { jsonResponse } from "../utils/response";
import { logger } from "../../shared/utils";

const API_KEY = process.env.USER_FEEDS_API_KEY || "";

export interface AuthResult {
  authorized: boolean;
  response?: Response;
}

/**
 * Check if the request has a valid API key.
 */
export function checkApiKey(req: Request): AuthResult {
  const apiKey = req.headers.get("api-key");

  if (!API_KEY) {
    logger.warn("USER_FEEDS_API_KEY is not configured");
    return {
      authorized: false,
      response: jsonResponse({ message: "Unauthorized" }, 401),
    };
  }

  if (apiKey !== API_KEY) {
    return {
      authorized: false,
      response: jsonResponse({ message: "Unauthorized" }, 401),
    };
  }

  return { authorized: true };
}

/**
 * Wrapper for protected endpoints that require API key authentication.
 * Returns the handler result if authorized, or a 401 response if not.
 */
export async function withAuth(
  req: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const auth = checkApiKey(req);
  if (!auth.authorized) {
    return auth.response!;
  }
  return handler();
}
