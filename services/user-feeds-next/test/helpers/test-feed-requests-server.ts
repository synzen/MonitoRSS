import type { Server } from "bun";
import { createHash, randomUUID } from "crypto";
import { FeedResponseRequestStatus } from "../../src/feed-fetcher";

interface FeedRequestBody {
  url: string;
  executeFetch?: boolean;
  executeFetchIfNotExists?: boolean;
  executeFetchIfStale?: boolean;
  hashToCompare?: string;
  lookupDetails?: {
    key: string;
    url?: string;
    headers?: Record<string, string>;
  };
}

/** Error status types that can be simulated */
type ErrorRequestStatus =
  | FeedResponseRequestStatus.FetchTimeout
  | FeedResponseRequestStatus.BadStatusCode
  | FeedResponseRequestStatus.FetchError
  | FeedResponseRequestStatus.InternalError
  | FeedResponseRequestStatus.ParseError;

type ResponseProvider = () =>
  | { body: string; hash?: string }
  | { requestStatus: ErrorRequestStatus; statusCode?: number };

export interface TestFeedRequestsServer {
  server: Server<undefined>;
  port: number;
  /** Register a response provider for a specific URL */
  registerUrl(url: string, provider: ResponseProvider): void;
  /** Unregister a URL */
  unregisterUrl(url: string): void;
  /** Generate a unique test URL */
  generateTestUrl(testId?: string): string;
  /** Set default response for unregistered URLs (backward compatibility) */
  setResponse(fn: ResponseProvider): void;
  /** Get all requests */
  getRequests(): Array<{ url: string; body: FeedRequestBody }>;
  /** Get requests for a specific URL */
  getRequestsForUrl(url: string): Array<{ url: string; body: FeedRequestBody }>;
  /** Clear all state */
  clear(): void;
  /** Clear state for a specific URL only */
  clearUrl(url: string): void;
}

export function createTestFeedRequestsServer(): TestFeedRequestsServer {
  const requests: Array<{ url: string; body: FeedRequestBody }> = [];

  // URL -> ResponseProvider map
  const urlRegistry = new Map<string, ResponseProvider>();

  // Default fallback for unregistered URLs (backward compatibility)
  let defaultResponseProvider: ResponseProvider = () => ({
    body: "",
    hash: "",
  });

  const server = Bun.serve({
    port: 0, // Random available port
    fetch: async (req) => {
      const body = (await req.json()) as FeedRequestBody;
      requests.push({ url: body.url, body });

      // Look up URL-specific provider, fall back to default
      const provider = urlRegistry.get(body.url) ?? defaultResponseProvider;
      const providerResult = provider();

      // Handle error responses
      if ("requestStatus" in providerResult) {
        const { requestStatus } = providerResult;

        // BadStatusCode needs a statusCode in the response
        if (requestStatus === FeedResponseRequestStatus.BadStatusCode) {
          return Response.json({
            requestStatus,
            response: {
              statusCode: providerResult.statusCode ?? 500,
            },
          });
        }

        return Response.json({ requestStatus });
      }

      // Handle success responses
      const { body: rssBody, hash } = providerResult;
      const computedHash =
        hash || createHash("sha256").update(rssBody).digest("hex");

      // If hashToCompare matches, return MatchedHash status (simulates unchanged feed)
      if (body.hashToCompare && body.hashToCompare === computedHash) {
        return Response.json({
          requestStatus: FeedResponseRequestStatus.MatchedHash,
          response: {
            body: "",
            hash: computedHash,
            statusCode: 200,
          },
        });
      }

      return Response.json({
        requestStatus: FeedResponseRequestStatus.Success,
        response: {
          body: rssBody,
          hash: computedHash,
          statusCode: 200,
        },
      });
    },
  });

  // When using port 0, Bun assigns an available port
  const assignedPort = server.port;
  if (assignedPort === undefined) {
    throw new Error("Failed to get assigned port from Bun.serve()");
  }

  return {
    server,
    port: assignedPort,

    registerUrl: (url, provider) => {
      urlRegistry.set(url, provider);
    },

    unregisterUrl: (url) => {
      urlRegistry.delete(url);
    },

    generateTestUrl: (testId?: string) => {
      const id = testId ?? randomUUID();
      return `https://test-feed.example.com/${id}/rss`;
    },

    setResponse: (fn) => {
      defaultResponseProvider = fn;
    },

    getRequests: () => [...requests],

    getRequestsForUrl: (url) => requests.filter((r) => r.url === url),

    clear: () => {
      requests.length = 0;
      urlRegistry.clear();
    },

    clearUrl: (url) => {
      urlRegistry.delete(url);
      // Remove requests for this URL
      for (let i = requests.length - 1; i >= 0; i--) {
        if (requests[i]!.url === url) {
          requests.splice(i, 1);
        }
      }
    },
  };
}
