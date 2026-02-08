import type { TestContext } from "node:test";
import {
  createTestHttpServer,
  type MockResponse,
  type RecordedRequest,
  type TestHttpServer,
} from "./test-http-server";
import { generateTestId } from "./test-id";
import type { Config } from "../../src/config";

export interface MockApi {
  server: TestHttpServer;
  configKey: keyof Config;
  intercept(t: TestContext, response: MockResponse): string;
  stop(): Promise<void>;
}

interface ArticleIdDiscriminatorOptions {
  method: string;
  path: string;
  extractId: (body: unknown) => string | undefined;
}

function createMockApi(
  configKey: keyof Config,
  discriminator: ArticleIdDiscriminatorOptions,
  defaultResponse: MockResponse = {
    status: 200,
    body: { status: "SUCCESS" },
  },
): MockApi {
  const server = createTestHttpServer();
  const responses = new Map<string, MockResponse>();

  server.registerRoute(
    discriminator.method,
    discriminator.path,
    (req: RecordedRequest) => {
      const id = discriminator.extractId(req.body);

      if (id && responses.has(id)) {
        return responses.get(id)!;
      }

      return defaultResponse;
    },
  );

  return {
    server,
    configKey,
    intercept(t: TestContext, response: MockResponse): string {
      const id = generateTestId();
      responses.set(id, response);
      t.after(() => {
        responses.delete(id);
      });
      return id;
    },
    async stop() {
      await server.stop();
    },
  };
}

export function createMockFeedHandlerApi(): MockApi {
  return createMockApi("BACKEND_API_USER_FEEDS_API_HOST", {
    method: "POST",
    path: "/v1/user-feeds/test",
    extractId: (body) => {
      const b = body as { article?: { id?: string } } | undefined;
      return b?.article?.id;
    },
  });
}

export function createMockFeedHandlerPreviewApi(): MockApi {
  return createMockApi(
    "BACKEND_API_USER_FEEDS_API_HOST",
    {
      method: "POST",
      path: "/v1/user-feeds/preview",
      extractId: (body) => {
        const b = body as { article?: { id?: string } } | undefined;
        return b?.article?.id;
      },
    },
    {
      status: 200,
      body: { status: "SUCCESS", customPlaceholderPreviews: [] },
    },
  );
}

export function createMockFeedHandlerFilterValidationApi(): MockApi & {
  server: TestHttpServer;
} {
  const server = createTestHttpServer();

  server.registerRoute("POST", "/v1/user-feeds/filter-validation", () => ({
    status: 200,
    body: { result: { errors: [] } },
  }));

  return {
    server,
    configKey: "BACKEND_API_USER_FEEDS_API_HOST",
    intercept(_t: TestContext, _response: MockResponse): string {
      return generateTestId();
    },
    async stop() {
      await server.stop();
    },
  };
}
