import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Session } from "../../common";
import {
  setupEndpointTests,
  teardownEndpointTests,
} from "../../utils/endpoint-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { getModelToken } from "@nestjs/mongoose";
import { ApiErrorCode } from "../../common/constants/api-errors";
import { HttpStatus } from "@nestjs/common";

import { FeedConnectionType } from "../feeds/constants";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
} from "../../common/exceptions";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import { FeedConnectionsDiscordWebhooksModule } from "./feed-connections-discord-webhooks.module";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";

jest.mock("../../utils/logger");

describe("FeedConnectionsDiscordWebhooksModule", () => {
  let app: NestFastifyApplication;
  let userFeedModel: UserFeedModel;
  let setAccessToken: (accessToken: Session["accessToken"]) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: "",
    },
  };
  let createdFeed: UserFeed;
  let baseApiUrl: string;
  let feedConnectionsService: FeedConnectionsDiscordWebhooksService;
  const discordUserId = "discord-user-id";

  beforeEach(async () => {
    [createdFeed] = await userFeedModel.create([
      {
        title: "my feed",
        url: "url",
        user: {
          discordUserId,
        },
      },
    ]);

    baseApiUrl = `/user-feeds/${createdFeed._id}/connections`;
  });

  beforeAll(async () => {
    const { init, uncompiledModule } = setupEndpointTests({
      imports: [
        FeedConnectionsDiscordWebhooksModule,
        MongooseTestModule.forRoot(),
      ],
    });

    uncompiledModule
      .overrideProvider(FeedConnectionsDiscordWebhooksService)
      .useValue({
        createDiscordWebhookConnection: jest.fn(),
        updateDiscordWebhookConnection: jest.fn(),
        deleteDiscordWebhookConnection: jest.fn(),
        sendTestArticle: jest.fn(),
      });

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: "accessToken",
      discord: {
        id: discordUserId,
      },
    } as Session["accessToken"]);

    userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));
    feedConnectionsService = app.get(FeedConnectionsDiscordWebhooksService);
  });

  afterEach(async () => {
    await userFeedModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownEndpointTests();
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

    it("returns 404 if user does not own feed", async () => {
      const differentUserCookie = await setAccessToken({
        access_token: "accessToken",
        discord: {
          id: "different-user",
        },
      } as Session["accessToken"]);

      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks`,
        payload: validBody,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
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
            guildId: "guild-id",
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
              guildId: connection.details.webhook.guildId,
            },
          },
        })
      );

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("POST /discord-webhooks/:connectionId/test", () => {
    const connectionIdToUse = new Types.ObjectId();

    beforeEach(async () => {
      await userFeedModel.updateOne(
        {
          _id: createdFeed._id,
        },
        {
          $set: {
            connections: {
              discordWebhooks: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    webhook: {
                      id: "webhook-id",
                    },
                    embeds: [],
                  },
                },
              ],
            },
          },
        }
      );
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}/test`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if user does not own feed", async () => {
      const differentUserCookie = await setAccessToken({
        access_token: "accessToken",
        discord: {
          id: "different-user",
        },
      } as Session["accessToken"]);

      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}/test`,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed is not found", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-webhooks/${connectionIdToUse}/test`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed connection is not found", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks/${new Types.ObjectId()}/test`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns the test result", async () => {
      const testResult = {
        status: TestDeliveryStatus.Success,
      };

      jest
        .spyOn(feedConnectionsService, "sendTestArticle")
        .mockResolvedValue(testResult);

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}/test`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        status: TestDeliveryStatus.Success,
      });

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("PATCH /discord-webhooks/:connectionId", () => {
    const validBody = {
      name: "connection-name",
      webhook: {
        id: "webhook-id",
        iconUrl: "icon-url",
        name: "webhook-name",
      },
    };
    const connectionIdToUse = new Types.ObjectId();

    beforeEach(async () => {
      await userFeedModel.updateOne(
        {
          _id: createdFeed._id,
        },
        {
          $set: {
            connections: {
              discordWebhooks: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    webhook: {
                      id: "webhook-id",
                    },
                    embeds: [],
                  },
                },
              ],
            },
          },
        }
      );
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
        payload: validBody,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if user does not own feed", async () => {
      const differentUserCookie = await setAccessToken({
        access_token: "accessToken",
        discord: {
          id: "different-user",
        },
      } as Session["accessToken"]);

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
        payload: validBody,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 400 with the right error code if webhook does not exist", async () => {
      jest
        .spyOn(feedConnectionsService, "updateDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookNonexistentException());

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
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
        .spyOn(feedConnectionsService, "updateDiscordWebhookConnection")
        .mockRejectedValue(new DiscordWebhookInvalidTypeException());

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
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

    it("returns 400 with bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
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

    it("returns the updated discord webhook connection", async () => {
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
            guildId: "guild-id",
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(feedConnectionsService, "updateDiscordWebhookConnection")
        .mockResolvedValue(connection);

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
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
              guildId: connection.details.webhook.guildId,
            },
          },
        })
      );

      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("DELETE /discord-webhooks/:connectionId", () => {
    const connectionIdToUse = new Types.ObjectId();

    beforeEach(async () => {
      await userFeedModel.updateOne(
        {
          _id: createdFeed._id,
        },
        {
          $set: {
            connections: {
              discordWebhooks: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    webhook: {
                      id: "webhook-id",
                    },
                    embeds: [],
                  },
                },
              ],
            },
          },
        }
      );
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 404 if user does not own feed", async () => {
      const differentUserCookie = await setAccessToken({
        access_token: "accessToken",
        discord: {
          id: "different-user",
        },
      } as Session["accessToken"]);

      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed is not found", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-webhooks/${connectionIdToUse}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if connection is not found", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-webhooks/${new Types.ObjectId()}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 204 if connection is deleted", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-webhooks/${connectionIdToUse}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
