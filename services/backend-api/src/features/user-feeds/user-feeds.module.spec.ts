import { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  setupEndpointTests,
  teardownEndpointTests,
} from "../../utils/endpoint-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import nock from "nock";
import { CACHE_MANAGER, HttpStatus } from "@nestjs/common";
import { Session } from "../../common";
import { getModelToken } from "@nestjs/mongoose";
import path from "path";
import { Cache } from "cache-manager";
import { readFileSync } from "fs";
import { ApiErrorCode } from "../../common/constants/api-errors";
import { UserFeedsModule } from "./user-feeds.module";
import { UserFeed, UserFeedModel } from "./entities";
import { CreateUserFeedInputDto } from "./dto";
import { ConfigService } from "@nestjs/config";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { UserFeedHealthStatus } from "./types";

const feedXml = readFileSync(
  path.join(__dirname, "../../test/data/feed.xml"),
  "utf-8"
);

jest.mock("../../utils/logger");

describe("UserFeedsModule", () => {
  let app: NestFastifyApplication;
  let userFeedModel: UserFeedModel;
  let feedFetcherApiHost: string;
  let feedHandlerApiHost: string;
  let setAccessToken: (accessToken: Session["accessToken"]) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: "",
      "content-type": "application/json",
    },
  };
  let discordAuthService: DiscordAuthService;
  const mockDiscordUser = {
    id: "discord-user-id",
  };

  beforeAll(async () => {
    const { init, uncompiledModule } = setupEndpointTests({
      imports: [UserFeedsModule, MongooseTestModule.forRoot()],
    });

    uncompiledModule
      .overrideProvider(DiscordAuthService)
      .useValue(discordAuthService);

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: "accessToken",
      discord: {
        id: mockDiscordUser.id,
      },
    } as Session["accessToken"]);

    userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));
    discordAuthService = app.get<DiscordAuthService>(DiscordAuthService);
    feedFetcherApiHost = app
      .get(ConfigService)
      .getOrThrow<string>("BACKEND_API_FEED_REQUESTS_API_HOST");

    feedHandlerApiHost = app
      .get(ConfigService)
      .getOrThrow<string>("BACKEND_API_FEED_HANDLER_API_HOST");
  });

  beforeEach(() => {
    jest
      .spyOn(discordAuthService, "getUser")
      .mockResolvedValue(mockDiscordUser as never);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    nock.cleanAll();
    await userFeedModel?.deleteMany({});

    const cacheManager = app.get<Cache>(CACHE_MANAGER);
    cacheManager.reset();
  });

  afterAll(async () => {
    await teardownEndpointTests();
  });

  describe("POST /user-feeds", () => {
    const validBody: CreateUserFeedInputDto = {
      title: "title",
      url: "https://www.feed.com",
    };

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds`,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns the correct error codes for feed request-related errors", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 429,
          },
        });

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        code: ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
      });
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns created feed details on success", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 200,
            body: feedXml,
          },
        });

      nock(feedFetcherApiHost).post("/v1/user-feeds/initialize").reply(204);

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        result: {
          title: "title",
          url: "https://www.feed.com",
          id: expect.any(String),
        },
      });
      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("GET /:feedId", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id.toHexString()}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id.toHexString()}1`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed does not belong to user", async () => {
      const otherFeed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: "other-discord-user-id",
        },
      });

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${otherFeed._id.toHexString()}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns feed details on success", async () => {
      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id.toHexString()}`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          result: expect.objectContaining({
            title: "title",
            url: "https://www.feed.com",
            id: feed._id.toHexString(),
          }),
        })
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("PATCH /:feedId", () => {
    let feed: UserFeed;
    const validBody = {
      title: "hello world",
      url: "https://www.google.com/feed",
    };

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/${feed._id.toHexString()}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/does-not-exist`,
        ...standardRequestOptions,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 403 if feed does not belong to user", async () => {
      const otherUserFeed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: "other-user",
        },
      });

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/${otherUserFeed.id}`,
        ...standardRequestOptions,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 400 if payload is not valid", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/${feed._id.toHexString()}`,
        payload: {
          title: "",
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 if feed request fails", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 429,
          },
        });

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/${feed._id.toHexString()}`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 200 on success", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 200,
            body: feedXml,
          },
        });

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `/user-feeds/${feed._id.toHexString()}`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        result: {
          title: validBody.title,
          url: validBody.url,
          id: feed._id.toHexString(),
        },
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("GET /", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 if missing query params", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns the total count and feeds", async () => {
      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/user-feeds?limit=10&offset=0`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        total: 1,
        results: [
          {
            id: feed._id.toHexString(),
            title: feed.title,
            url: feed.url,
            healthStatus: feed.healthStatus,
          },
        ],
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("GET /:feedId/retry", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
        healthStatus: UserFeedHealthStatus.Failed,
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/retry`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/123/retry`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed does not belong to user", async () => {
      const otherUserFeed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: "other-user",
        },
      });

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${otherUserFeed._id}/retry`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 200 on success", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 200,
            body: feedXml,
          },
        });

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/retry`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
    });

    it("returns 400 if feed is not failed", async () => {
      await userFeedModel.updateOne(
        { _id: feed._id },
        {
          $set: {
            healthStatus: UserFeedHealthStatus.Ok,
          },
        }
      );

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/retry`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        code: ApiErrorCode.FEED_NOT_FAILED,
      });
      expect(statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it("returns the correct status for request-related errors", async () => {
      nock(feedFetcherApiHost)
        .post("/v1/feed-requests")
        .reply(200, {
          requestStatus: "success",
          response: {
            statusCode: 429,
          },
        });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/retry`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        code: ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
      });
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe("GET /:feedId/daily-limit", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/daily-limit`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/123/daily-limit`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed does not belong to user", async () => {
      const otherUserFeed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: "other-user",
        },
      });

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${otherUserFeed._id}/daily-limit`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns the correct daily limit", async () => {
      nock(feedHandlerApiHost)
        .get(`/api/v1/user-feeds/${feed._id}/rate-limits`)
        .reply(200, {
          results: {
            limits: [
              {
                progress: 0,
                max: 1000,
                remaining: 100,
                windowSeconds: 60,
              },
              {
                progress: 0,
                max: 100,
                remaining: 100,
                windowSeconds: 86400,
              },
            ],
          },
        });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/daily-limit`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        result: {
          current: 0,
          max: 100,
        },
      });
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it("returns 404 if no daily limit is found", async () => {
      nock(feedHandlerApiHost)
        .get(`/api/v1/user-feeds/${feed._id}/rate-limits`)
        .reply(200, {
          results: {
            limits: [
              {
                progress: 0,
                limit: 1000,
                remaining: 100,
                windowSeconds: 60,
              },
            ],
          },
        });

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/user-feeds/${feed._id}/daily-limit`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe("DELETE /:feedId", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: mockDiscordUser.id,
        },
      });
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `/user-feeds/${feed._id}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `/user-feeds/123`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 403 if feed does not belong to user", async () => {
      const otherUserFeed = await userFeedModel.create({
        title: "title",
        url: "https://www.feed.com",
        user: {
          discordUserId: "other-user",
        },
      });

      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `/user-feeds/${otherUserFeed._id}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 204 on success", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `/user-feeds/${feed._id}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
