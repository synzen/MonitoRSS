import type { Server } from "bun";
import { createHash } from "crypto";
import { FeedResponseRequestStatus } from "../src/feed-fetcher";

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

export interface TestFeedRequestsServer {
  server: Server<undefined>;
  port: number;
  setResponse(fn: () => { body: string; hash?: string }): void;
  getRequests(): Array<{ url: string; body: FeedRequestBody }>;
  clear(): void;
}

export function createTestFeedRequestsServer(
  port = 5556
): TestFeedRequestsServer {
  const requests: Array<{ url: string; body: FeedRequestBody }> = [];
  let responseProvider: () => { body: string; hash?: string } = () => ({
    body: "",
    hash: "",
  });

  const server = Bun.serve({
    port,
    fetch: async (req) => {
      const body = (await req.json()) as FeedRequestBody;
      requests.push({ url: body.url, body });

      const { body: rssBody, hash } = responseProvider();
      const computedHash =
        hash || createHash("sha256").update(rssBody).digest("hex");

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

  return {
    server,
    port,
    setResponse: (fn) => {
      responseProvider = fn;
    },
    getRequests: () => [...requests],
    clear: () => {
      requests.length = 0;
    },
  };
}
