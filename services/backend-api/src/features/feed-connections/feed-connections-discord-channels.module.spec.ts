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
import { UserMissingManageGuildException } from "../feeds/exceptions";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";
import {
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionDiscordComponentType,
  FeedConnectionType,
} from "../feeds/constants";
import { Types } from "mongoose";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
import { FeedConnectionsDiscordChannelsModule } from "./feed-connections-discord-channels.module";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { randomUUID } from "crypto";

jest.mock("../../utils/logger");

describe("FeedConnectionsDiscordChannelsModule", () => {
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
  let feedConnectionsService: FeedConnectionsDiscordChannelsService;
  const discordUserId = "user-id";

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
        FeedConnectionsDiscordChannelsModule.forRoot(),
        MongooseTestModule.forRoot(),
      ],
    });

    uncompiledModule
      .overrideProvider(FeedConnectionsDiscordChannelsService)
      .useValue({
        createDiscordChannelConnection: jest.fn(),
        updateDiscordChannelConnection: jest.fn(),
        deleteConnection: jest.fn(),
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
    feedConnectionsService = app.get(FeedConnectionsDiscordChannelsService);
  });

  afterEach(async () => {
    await userFeedModel.deleteMany({});
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

    it("returns 404 if user does not own feed", async () => {
      const differentUserCookie = await setAccessToken({
        access_token: "accessToken",
        discord: {
          id: "different-user",
        },
      } as Session["accessToken"]);

      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels`,
        payload: validBody,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
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
            guildId: "guild",
          },
          embeds: [],
          content: "content",
          formatter: {
            formatTables: false,
            stripImages: false,
          },
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
              guildId: connection.details.channel.guildId,
            },
            embeds: connection.details.embeds,
            content: connection.details.content,
          },
        })
      );

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("POST /discord-channels/:id/test", () => {
    const connectionIdToUse = new Types.ObjectId();

    beforeEach(async () => {
      await userFeedModel.updateOne(
        {
          _id: createdFeed._id,
        },
        {
          $set: {
            connections: {
              discordChannels: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    channel: {
                      id: "channel-id",
                      guildId: "guild-id",
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}/test`,
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}/test`,
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
        )}/discord-channels/${connectionIdToUse}/test`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed connection is not found", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `${baseApiUrl}/discord-channels/${new Types.ObjectId()}/test`,
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}/test`,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
        status: TestDeliveryStatus.Success,
      });

      expect(statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe("PATCH /discord-channels/:id", () => {
    const validBody = {
      name: "connection-name",
      componentRows: [
        {
          id: randomUUID(),
          components: [
            {
              id: randomUUID(),
              type: FeedConnectionDiscordComponentType.Button,
              label: "label",
              url: "url",
              style: FeedConnectionDiscordComponentButtonStyle.Link,
            },
          ],
        },
      ],
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
              discordChannels: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    channel: {
                      id: "channel-id",
                      guildId: "guild-id",
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
        payload: validBody,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 400 with the right error code if channel returns 403", async () => {
      jest
        .spyOn(feedConnectionsService, "updateDiscordChannelConnection")
        .mockRejectedValue(new DiscordChannelPermissionsException());

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
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
        .spyOn(feedConnectionsService, "updateDiscordChannelConnection")
        .mockRejectedValue(new MissingDiscordChannelException());

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
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
        .spyOn(feedConnectionsService, "updateDiscordChannelConnection")
        .mockRejectedValue(new UserMissingManageGuildException());

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
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
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
        payload: {
          channelId: {
            id: "1",
          },
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 404 if feed is not found", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-channels/${connectionIdToUse}`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if feed connection is not found", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${new Types.ObjectId()}`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns the updated discord channel connection", async () => {
      const connection = {
        id: new Types.ObjectId(),
        name: "name",
        details: {
          channel: {
            id: "id",
            guildId: "guild",
          },
          embeds: [],
          content: "content",
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(feedConnectionsService, "updateDiscordChannelConnection")
        .mockResolvedValue(connection);

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
        payload: validBody,
        ...standardRequestOptions,
      });

      expect(JSON.parse(body)).toMatchObject({
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
      });

      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("DELETE /discord-channels/:id", () => {
    const connectionIdToUse = new Types.ObjectId();

    beforeEach(async () => {
      await userFeedModel.updateOne(
        {
          _id: createdFeed._id,
        },
        {
          $set: {
            connections: {
              discordChannels: [
                {
                  id: connectionIdToUse,
                  name: "name",
                  details: {
                    channel: {
                      id: "channel-id",
                      guildId: "guild-id",
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

    it("returns 401 if not authenticated", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
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
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
        headers: {
          ...standardRequestOptions.headers,
          cookie: differentUserCookie,
        },
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if the connection does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-channels/${new Types.ObjectId()}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 404 if the feed does not exist", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl.replace(
          createdFeed._id.toHexString(),
          new Types.ObjectId().toHexString()
        )}/discord-channels/${connectionIdToUse}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns 204 and deletes the connection", async () => {
      const { statusCode } = await app.inject({
        method: "DELETE",
        url: `${baseApiUrl}/discord-channels/${connectionIdToUse}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
