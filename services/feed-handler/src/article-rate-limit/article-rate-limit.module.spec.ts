import { ArticleRateLimitModule } from "./article-rate-limit.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { FeedArticleDeliveryLimit } from "./entities";
import {
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { EntityRepository } from "@mikro-orm/postgresql";
import { getRepositoryToken } from "@mikro-orm/nestjs";
import { HttpStatus } from "@nestjs/common";
import { testConfig } from "../config/test.config";

describe("ArticleRateLimitModule", () => {
  let app: NestFastifyApplication;
  let deliveryLimitRepo: EntityRepository<FeedArticleDeliveryLimit>;
  const standardHeaders = {
    "api-key": testConfig().FEED_HANDLER_API_KEY,
  };

  beforeAll(async () => {
    const { init, uncompiledModule } = await setupIntegrationTests(
      {
        imports: [ArticleRateLimitModule],
      },
      {
        models: [FeedArticleDeliveryLimit],
      }
    );

    const moduleRef = await uncompiledModule.compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await init();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    deliveryLimitRepo = moduleRef.get<
      EntityRepository<FeedArticleDeliveryLimit>
    >(getRepositoryToken(FeedArticleDeliveryLimit));
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await app?.close();
  });

  describe(`GET /feeds/:feedId/rate-limits`, () => {
    it("returns 401 if unauthorized", async () => {
      const feedId = "feed-id";
      const created = await deliveryLimitRepo.create({
        feed_id: feedId,
        limit: 10,
        time_window_seconds: 60,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await deliveryLimitRepo.persistAndFlush(created);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/feeds/${feedId}/rate-limits`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 200", async () => {
      const feedId = "feed-id";
      const created = await deliveryLimitRepo.create({
        feed_id: feedId,
        limit: 10,
        time_window_seconds: 60,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await deliveryLimitRepo.persistAndFlush(created);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/feeds/${feedId}/rate-limits`,
        headers: standardHeaders,
      });

      expect(JSON.parse(body)).toMatchObject({
        results: {
          limits: expect.arrayContaining([
            expect.objectContaining({
              progress: expect.any(Number),
              max: expect.any(Number),
              remaining: expect.any(Number),
              windowSeconds: expect.any(Number),
            }),
          ]),
        },
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });
});
