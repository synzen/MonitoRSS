import { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  setupEndpointTests,
  teardownEndpointTests,
} from "../../utils/endpoint-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { HttpStatus } from "@nestjs/common";
import { Session } from "../../common";
import { DiscordUserModule } from "./discord-users.module";
import { DiscordUser } from "./types/DiscordUser.type";
import { createTestSupporter } from "../../test/data/supporters.test-data";
import dayjs from "dayjs";
import {
  Supporter,
  SupporterModel,
} from "../supporters/entities/supporter.entity";
import { getModelToken } from "@nestjs/mongoose";
import { DiscordUsersService } from "./discord-users.service";
import { SupportersService } from "../supporters/supporters.service";

jest.mock("../../utils/logger");

describe("DiscordServersModule", () => {
  let app: NestFastifyApplication;
  let supporterModel: SupporterModel;
  let setAccessToken: (accessToken: Session["accessToken"]) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: "",
    },
  };
  const mockUser: DiscordUser = {
    id: "12345",
    username: "Test User",
    discriminator: "1234",
    avatar: "avatar-hash",
  };
  let discordUsersService: DiscordUsersService;
  let supportersService: SupportersService;

  beforeAll(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordUserModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    // To do - set up an endpoint to use the session middleware, set the session, and then run tests

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: "accessToken",
      discord: {
        id: mockUser.id,
      },
    } as Session["accessToken"]);

    supporterModel = app.get<SupporterModel>(getModelToken(Supporter.name));
    discordUsersService = app.get(DiscordUsersService);
    supportersService = app.get(SupportersService);
  });

  afterEach(async () => {
    await supporterModel.deleteMany();
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await teardownEndpointTests();
  });

  describe("GET /discord-users/@me", () => {
    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-users/@me`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns user with no supporter details", async () => {
      const mockUser = {
        id: "1",
        username: "username",
        discriminator: "discriminator",
        avatarUrl: "str",
        avatar: null,
        maxFeeds: 12,
        maxUserFeeds: 13,
      };
      jest.spyOn(discordUsersService, "getUser").mockResolvedValue(mockUser);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-users/@me`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toMatchObject({
        id: mockUser.id,
        username: mockUser.username,
        maxFeeds: mockUser.maxFeeds,
        iconUrl: mockUser.avatarUrl,
        maxUserFeeds: mockUser.maxUserFeeds,
      });
    });

    it("returns user with supporter details", async () => {
      const mockUser = {
        id: "1",
        username: "username",
        discriminator: "discriminator",
        avatar: null,
        avatarUrl: "avatar",
        maxFeeds: 12,
        maxUserFeeds: 13,
        supporter: {
          maxFeeds: 12,
          guilds: ["1", "2"],
          maxGuilds: 3,
          expireAt: new Date(2020),
        },
      };
      jest.spyOn(discordUsersService, "getUser").mockResolvedValue(mockUser);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-users/@me`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        iconUrl: mockUser.avatarUrl,
        maxFeeds: mockUser.supporter.maxFeeds,
        maxUserFeeds: mockUser.maxUserFeeds,
        supporter: {
          guilds: mockUser.supporter.guilds,
          maxFeeds: mockUser.supporter.maxFeeds,
          maxGuilds: mockUser.supporter.maxGuilds,
          expireAt: mockUser.supporter.expireAt?.toISOString(),
        },
      });
    });
  });

  describe("PATCH /discord-users/@me/supporter", () => {
    const mockDiscordUser = {
      id: mockUser.id,
      username: "username",
      discriminator: "discriminator",
      avatar: null,
      avatarUrl: "avatar",
      maxFeeds: 12,
      maxUserFeeds: 13,
      supporter: {
        maxFeeds: 12,
        guilds: ["1", "2"],
        maxGuilds: 3,
        expireAt: new Date(2020),
      },
    };
    beforeEach(() => {
      jest
        .spyOn(discordUsersService, "getUser")
        .mockResolvedValue(mockDiscordUser);

      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({
          isSupporter: true,
        } as never);
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-users/@me/supporter`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 403 if user is not a supporter", async () => {
      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({
          isSupporter: false,
        } as never);

      // User has no "supporter" document
      const payload = {
        guildIds: ["1", "2", "3"],
      };

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it("returns 204 if valid supporter", async () => {
      const supporter = createTestSupporter({
        _id: mockUser.id,
        expireAt: dayjs().add(2, "day").toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ["1", "2"],
      });

      await supporterModel.create(supporter);

      const payload = {
        guildIds: ["1", "2", "3"],
      };

      const result = await app.inject({
        method: "PATCH",
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(result.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it("ignores empty strings in guild ids", async () => {
      const supporter = createTestSupporter({
        _id: mockUser.id,
        expireAt: dayjs().add(2, "day").toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ["1", "2"],
      });

      await supporterModel.create(supporter);

      const payload = {
        guildIds: ["1", "", "3", ""],
      };

      const result = await app.inject({
        method: "PATCH",
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(result.statusCode).toEqual(HttpStatus.NO_CONTENT);

      const foundSupporter = await supporterModel
        .findOne({
          _id: mockUser.id,
        })
        .lean();

      expect(foundSupporter?.guilds).toEqual([
        payload.guildIds[0],
        payload.guildIds[2],
      ]);
    });
  });

  describe("GET /users/@me/servers", () => {
    const mockServers = [
      {
        id: "123",
        name: "Test Guild",
        owner: true,
        permissions: "0",
        iconUrl: "icon-url",
        benefits: {
          maxFeeds: 10,
          webhooks: false,
        },
      },
      {
        id: "456",
        name: "Test Guild 2",
        owner: true,
        permissions: "0",
        iconUrl: "icon-url",
        benefits: {
          maxFeeds: 10,
          webhooks: false,
        },
      },
    ];

    beforeEach(() => {
      jest
        .spyOn(discordUsersService, "getGuilds")
        .mockResolvedValue(mockServers);
    });

    it("returns 401 if not logged in with discord", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-users/@me/servers`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns the user's servers", async () => {
      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-users/@me/servers`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        results: mockServers.map((server) => ({
          id: server.id,
          name: server.name,
          iconUrl: expect.any(String),
          benefits: {
            maxFeeds: expect.any(Number),
            webhooks: expect.any(Boolean),
          },
        })),
        total: mockServers.length,
      });
    });

    it("does not return servers the user does not have permission in", async () => {
      jest.spyOn(discordUsersService, "getGuilds").mockResolvedValue([]);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-users/@me/servers`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        results: [],
        total: 0,
      });
    });
  });
});
