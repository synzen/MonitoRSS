import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import {
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { HttpStatus } from "@nestjs/common";
import { testConfig } from "../config/test.config";
import { FeedsModule } from "./feeds.module";

describe("FeedsModule", () => {
  let app: NestFastifyApplication;
  const standardHeaders = {
    "api-key": testConfig().USER_FEEDS_API_KEY,
  };

  beforeAll(async () => {
    const { init, uncompiledModule } = await setupIntegrationTests({
      imports: [FeedsModule],
    });

    const moduleRef = await uncompiledModule.compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await init();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await app?.close();
  });

  describe(`POST /user-feeds`, () => {
    const validPayload = {
      feed: {
        id: "feed-id",
      },
      articleDailyLimit: 100,
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/initialize`,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 201", async () => {
      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds/initialize`,
        headers: standardHeaders,
        payload: validPayload,
      });

      expect(JSON.parse(body)).toMatchObject({
        articleRateLimits: expect.arrayContaining([
          expect.objectContaining({
            progress: expect.any(Number),
            max: expect.any(Number),
            remaining: expect.any(Number),
            windowSeconds: expect.any(Number),
          }),
        ]),
      });
      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });
});
