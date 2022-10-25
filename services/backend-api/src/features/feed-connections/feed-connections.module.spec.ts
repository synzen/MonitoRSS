import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Session } from "../../common";
import {
  setupEndpointTests,
  teardownEndpointTests,
} from "../../utils/endpoint-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { FeedConnectionsModule } from "./feed-connections.module";
import { getModelToken } from "@nestjs/mongoose";
import { ApiErrorCode } from "../../common/constants/api-errors";
import { HttpStatus } from "@nestjs/common";
import { FeedConnectionsService } from "./feed-connections.service";
import { UserMissingManageGuildException } from "../feeds/exceptions";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";
import { FeedConnectionType } from "../feeds/constants";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  DiscordWebhookNotOwnedException,
} from "../../common/exceptions";

jest.mock("../../utils/logger");

describe("FeedConnectionsModule", () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let setAccessToken: (accessToken: Session["accessToken"]) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: "",
    },
  };
  let createdFeed: Feed;
  let baseApiUrl: string;
  let feedConnectionsService: FeedConnectionsService;

  beforeEach(async () => {
    [createdFeed] = await feedModel.create([
      {
        title: "my feed",
        channel: "688445354513137784",
        guild: "guild",
        isFeedv2: true,
        url: "url",
      },
    ]);

    baseApiUrl = `/feeds/${createdFeed._id}/connections`;
  });

  beforeAll(async () => {
    const { init, uncompiledModule } = setupEndpointTests({
      imports: [FeedConnectionsModule, MongooseTestModule.forRoot()],
    });

    uncompiledModule.overrideProvider(FeedConnectionsService).useValue({
      createDiscordChannelConnection: jest.fn(),
      createDiscordWebhookConnection: jest.fn(),
    });

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: "accessToken",
    } as Session["accessToken"]);

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
    feedConnectionsService = app.get(FeedConnectionsService);
  });

  afterEach(async () => {
    await feedModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownEndpointTests();
  });

  describe("POST /discord-channels", () => {
    const validBody = {
      name: "connection-name",
      channelId: "688445354513131101",
    };

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 with the right error code if channel returns 403", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordChannelConnection")
        .mockRejectedValue(new DiscordChannelPermissionsException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
        })
      );
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 with the right error code if channel does not exist", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordChannelConnection")
        .mockRejectedValue(new MissingDiscordChannelException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.FEED_MISSING_CHANNEL,
        })
      );
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 with the right error code if user does not manage channel guild", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordChannelConnection")
        .mockRejectedValue(new UserMissingManageGuildException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
        })
      );
      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 400 with bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: {
          channelId: "1",
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 404 if feed is not found", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-channels`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns the created discord channel connection", async () => {
      const connection = {
        id: new Types.ObjectId(),
        name: "name",
        details: {
          type: FeedConnectionType.DiscordChannel,
          channel: {
            id: validBody.channelId,
          },
          embeds: [],
          content: "content",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(feedConnectionsService, "createDiscordChannelConnection")
        .mockResolvedValue(connection);

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          id: connection.id.toHexString(),
          name: connection.name,
          key: FeedConnectionType.DiscordChannel,
          details: {
            channel: {
              id: connection.details.channel.id,
            },
            embeds: connection.details.embeds,
            content: connection.details.content,
          },
        })
      );

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("POST /discord-webhooks", () => {
    const validBody = {
      name: "connection-name",
      webhook: {
        id: "webhook-id",
        iconUrl: "icon-url",
        name: "webhook-name",
      },
    };

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 with the right error code if webhook does not exist", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookNonexistentException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.WEBHOOK_MISSING,
        })
      );
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 with the right error code if webhook is an invalid type", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookInvalidTypeException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.WEBHOOK_INVALID,
        })
      );
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 with the right error code if webhook is not owned by guild", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookNotOwnedException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.WEBHOOK_MISSING,
        })
      );
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 403 with the right code if user does not manage guild of webhook", async () => {
      jest
        .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookMissingUserPermException());

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
        })
      );

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 400 with bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: {
          channelId: "1",
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 404 if feed is not found", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns the created discord webhook connection", async () => {
      const connection = {
        id: new Types.ObjectId(),
        name: "name",
        filters: {
          expression: {
            foo: "bar",
          },
        },
        details: {
          embeds: [],
          content: "content",
          webhook: {
            id: "id",
            iconUrl: "iconUrl",
            name: "name",
            token: "token",
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
        .mockResolvedValue(connection);

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toEqual(
        expect.objectContaining({
          id: connection.id.toHexString(),
          name: connection.name,
          key: FeedConnectionType.DiscordWebhook,
          filters: {
            expression: {
              foo: "bar",
            },
          },
          details: {
            embeds: connection.details.embeds,
            content: connection.details.content,
            webhook: {
              id: connection.details.webhook.id,
              iconUrl: connection.details.webhook.iconUrl,
              name: connection.details.webhook.name,
            },
          },
        })
      );

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });
});
