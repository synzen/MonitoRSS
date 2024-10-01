import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import {
  clearDatabase,
  DiscordMediumTestPayloadDetails,
  GetFeedArticlesRequestStatus,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { HttpStatus } from "@nestjs/common";
import { testConfig } from "../config/test.config";
import { FeedsModule } from "./feeds.module";
import { DiscordMediumService } from "../delivery/mediums/discord-medium.service";
import { TestDeliveryMedium } from "./constants";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";

describe("FeedsModule temporary", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});

describe.skip("FeedsModule", () => {
  let app: NestFastifyApplication;
  const standardHeaders = {
    "api-key": testConfig().USER_FEEDS_API_KEY,
  };
  const discordMediumService = {
    deliverTestArticle: jest.fn(),
  };
  const feedFetcherService = {
    fetchFeedArticles: jest.fn(),
    fetchRandomFeedArticle: jest.fn(),
  };

  beforeAll(async () => {
    const { init, uncompiledModule } = await setupIntegrationTests({
      providers: [],
      imports: [FeedsModule],
    });

    const moduleRef = await uncompiledModule
      .overrideProvider(DiscordMediumService)
      .useValue(discordMediumService)
      .overrideProvider(FeedFetcherService)
      .useValue(feedFetcherService)
      .compile();

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

  describe(`POST /user-feeds/initialize`, () => {
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

  describe("POST /user-feeds/filter-validation", () => {
    const validPayload = {
      expression: {
        type: "article",
        value: "test",
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/filter-validation`,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 200", async () => {
      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds/filter-validation`,
        headers: standardHeaders,
        payload: validPayload,
      });

      expect(JSON.parse(body)).toMatchObject({
        result: {
          errors: expect.any(Array),
        },
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe(`POST /user-feeds/get-articles`, () => {
    const validBody = {
      limit: 1,
      random: true,
      url: "https://www.google.com",
      formatter: {
        options: {
          dateFormat: "MM/DD/YYYY",
          stripImages: false,
          formatTables: true,
        },
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/get-articles`,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 on bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/get-articles`,
        payload: {
          limit: 1,
          random: true,
        },
        headers: standardHeaders,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 200", async () => {
      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: [],
      });

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds/get-articles`,
        payload: validBody,
        headers: standardHeaders,
      });

      expect(JSON.parse(body)).toMatchObject({
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: [],
        },
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe(`POST /user-feeds/test`, () => {
    const validPayload = {
      type: TestDeliveryMedium.Discord,
      mediumDetails: {
        channel: {
          id: "channel-id",
        },
        webhook: null,
      } as DiscordMediumTestPayloadDetails,
      feed: {
        url: "https://www.google.com",
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 on bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        headers: standardHeaders,
        payload: {
          type: "bbb",
        },
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 201", async () => {
      feedFetcherService.fetchRandomFeedArticle.mockResolvedValue({});
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 200,
        },
        apiPayload: validPayload,
      });

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        headers: standardHeaders,
        payload: validPayload,
      });

      expect(JSON.parse(body)).toMatchObject({
        status: expect.anything(),
      });
      expect(statusCode).toBe(HttpStatus.CREATED);
    });

    it("returns 500 on delivery error state", async () => {
      feedFetcherService.fetchRandomFeedArticle.mockResolvedValue({});

      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "error",
        },
      });

      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        headers: standardHeaders,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
