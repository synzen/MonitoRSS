/* eslint-disable max-len */
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import {
  Patron,
  PatronFeature,
  PatronModel,
  PatronStatus,
} from "./entities/patron.entity";
import {
  Supporter,
  SupporterFeature,
  SupporterModel,
} from "./entities/supporter.entity";
import { SupportersService } from "./supporters.service";
import { createTestSupporter } from "../../test/data/supporters.test-data";
import { createTestPatron } from "../../test/data/patron.test-data";
import dayjs from "dayjs";
import { PatronsService } from "./patrons.service";
import { ConfigService } from "@nestjs/config";
import { GuildSubscriptionsService } from "./guild-subscriptions.service";

describe("SupportersService Integration", () => {
  let supportersService: SupportersService;
  let guildSubscriptionsService: GuildSubscriptionsService;
  let supporterModel: SupporterModel;
  let patronModel: PatronModel;
  const defaultMaxFeeds = 5;
  const defaultRefreshRateSeconds = 60;
  const userDiscordId = "user-discord-id";

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [SupportersService, PatronsService, GuildSubscriptionsService],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([SupporterFeature, PatronFeature]),
      ],
    });

    const configGetter = (key: string) => {
      if (key === "DEFAULT_MAX_FEEDS") {
        return defaultMaxFeeds;
      }

      if (key === "DEFAULT_REFRESH_RATE_MINUTES") {
        return defaultRefreshRateSeconds / 60;
      }

      throw new Error(
        `Config key ${key} not found. Implement it as a mock within the test`
      );
    };

    uncompiledModule
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: configGetter,
        get: configGetter,
      })
      .overrideProvider(GuildSubscriptionsService)
      .useValue({
        getAllSubscriptions: jest.fn(),
      });

    const { module } = await init();

    supportersService = module.get<SupportersService>(SupportersService);
    guildSubscriptionsService = module.get<GuildSubscriptionsService>(
      GuildSubscriptionsService
    );
    jest
      .spyOn(guildSubscriptionsService, "getAllSubscriptions")
      .mockResolvedValue([]);
    supportersService.defaultMaxFeeds = defaultMaxFeeds;
    supporterModel = module.get<SupporterModel>(getModelToken(Supporter.name));
    patronModel = module.get<PatronModel>(getModelToken(Patron.name));
  });

  afterEach(async () => {
    await supporterModel?.deleteMany({});
    await patronModel?.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  describe("getBenefitsOfDiscordUser", () => {
    it("returns defaults for all values if no supporter is found", async () => {
      const benefits = await supportersService.getBenefitsOfDiscordUser(
        userDiscordId
      );

      expect(benefits).toEqual({
        isSupporter: false,
        maxFeeds: defaultMaxFeeds,
        guilds: [],
        maxGuilds: 0,
        expireAt: undefined,
        refreshRateSeconds: defaultRefreshRateSeconds,
      });
    });
    it("returns the correct benefits", async () => {
      const supporter = createTestSupporter({
        _id: userDiscordId,
        expireAt: dayjs().add(1, "day").toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ["1", "2"],
      });

      await supporterModel.create(supporter);

      const benefits = await supportersService.getBenefitsOfDiscordUser(
        userDiscordId
      );

      expect(benefits).toEqual({
        isSupporter: true,
        maxFeeds: supporter.maxFeeds,
        guilds: supporter.guilds,
        maxGuilds: supporter.maxGuilds,
        expireAt: supporter.expireAt,
        refreshRateSeconds: 120,
      });
    });
  });

  describe("getBenefitsOfServers", () => {
    const serverId = "server-id";

    it("always returns results for every input server id", async () => {
      const serverIds = ["1", "2", "3"];

      const result = await supportersService.getBenefitsOfServers(serverIds);
      expect(result).toEqual([
        {
          hasSupporter: false,
          maxFeeds: defaultMaxFeeds,
          serverId: serverIds[0],
          webhooks: false,
        },
        {
          hasSupporter: false,
          maxFeeds: defaultMaxFeeds,
          serverId: serverIds[1],
          webhooks: false,
        },
        {
          hasSupporter: false,
          maxFeeds: defaultMaxFeeds,
          serverId: serverIds[2],
          webhooks: false,
        },
      ]);
    });

    describe("when there is no patron", () => {
      it("returns the supporter max feeds if supporter is not expired", async () => {
        const supporter = createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().add(3, "day").toDate(),
        });

        await supporterModel.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        expect(result[0].maxFeeds).toEqual(supporter.maxFeeds);
      });

      it("returns the default max feeds if supporter is expired", async () => {
        const supporter = await createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().subtract(1, "day").toDate(),
        });

        await supporterModel.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        expect(result[0].maxFeeds).toEqual(defaultMaxFeeds);
      });

      it("returns the default max feeds if supporter is not found", async () => {
        const result = await supportersService.getBenefitsOfServers([serverId]);

        expect(result[0].maxFeeds).toEqual(defaultMaxFeeds);
      });

      it("returns supporter max feeds if guild supporter has no expire at", async () => {
        const supporter = await createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
        });

        await supporterModel.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        expect(result[0].maxFeeds).toEqual(supporter.maxFeeds);
      });

      it("returns webhook and hasSupporter false for a supporter that expired", async () => {
        const supporter = await createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().subtract(10, "day").toDate(),
        });

        await supporterModel.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        expect(result[0]).toEqual(
          expect.objectContaining({
            hasSupporter: false,
            webhooks: false,
          })
        );
      });
    });
    describe("when there is a patron", () => {
      let supporterToInsert: Supporter;

      beforeEach(async () => {
        supporterToInsert = createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId],
          maxGuilds: 10,
          maxFeeds: 10,
        });

        await supporterModel.create(supporterToInsert);
      });

      it("returns hasSupporter: true and webhooks: true", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.ACTIVE,
          pledge: 100,
        });

        await patronModel.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        expect(result[0]).toEqual(
          expect.objectContaining({
            hasSupporter: true,
            webhooks: true,
          })
        );
      });
      it("returns the max feeds of an active patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.ACTIVE,
          pledge: 100,
        });

        await patronModel.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        expect(result[0].maxFeeds).toBe(supporterToInsert.maxFeeds);
      });

      it("returns the max feeds of a declined patron within the grace period", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(2, "days").toDate(),
        });

        await patronModel.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        expect(result[0].maxFeeds).toEqual(supporterToInsert.maxFeeds);
      });

      it("does not return the supporter max feeds of a long-expired declined patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(6, "days").toDate(),
        });

        await patronModel.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        expect(result[0].maxFeeds).toBe(defaultMaxFeeds);
      });

      it("does not return supporter max feeds of a former patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.FORMER,
          pledge: 100,
        });

        await patronModel.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        expect(result[0].maxFeeds).toBe(defaultMaxFeeds);
      });
    });
  });
  describe("for multiple servers", () => {
    const serverId1 = "server-id-1";
    const serverId2 = "server-id-2";

    it("returns the max feeds correctly", async () => {
      const supportersToInsert = [
        createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId1],
          maxGuilds: 10,
          maxFeeds: 10,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          _id: userDiscordId + "-other",
          guilds: [serverId2],
          maxGuilds: 20,
          maxFeeds: 20,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      await supporterModel.create(supportersToInsert);

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.serverId === serverId1)?.maxFeeds).toEqual(
        supportersToInsert[0].maxFeeds
      );
      expect(result.find((r) => r.serverId === serverId2)?.maxFeeds).toEqual(
        supportersToInsert[1].maxFeeds
      );
      // expect(result[0].maxFeeds).toBe(supporterToInsert.maxFeeds);
    });

    it("returns webhook for every one", async () => {
      const supportersToInsert = [
        createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId1],
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          _id: userDiscordId + "-other",
          guilds: [serverId2],
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      await supporterModel.create(supportersToInsert);

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.webhooks)).toBe(true);
    });

    it("returns max feeds correctly when a single guild has multiple supporters", async () => {
      const supportersToInsert = [
        createTestSupporter({
          _id: userDiscordId,
          guilds: [serverId1],
          maxGuilds: 10,
          maxFeeds: 10,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          _id: userDiscordId + "-other",
          guilds: [serverId1, serverId2],
          maxGuilds: 20,
          maxFeeds: 20,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          _id: userDiscordId + "-other-2",
          guilds: [serverId2],
          maxGuilds: 30,
          maxFeeds: 30,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      await supporterModel.create(supportersToInsert);

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.serverId === serverId1)?.maxFeeds).toEqual(
        supportersToInsert[1].maxFeeds
      );
      expect(result.find((r) => r.serverId === serverId2)?.maxFeeds).toEqual(
        supportersToInsert[2].maxFeeds
      );
    });
  });

  describe("setGuilds", () => {
    it("sets the guilds of the supporter", async () => {
      const guildIds = ["1", "2"];
      const supporterToInsert = createTestSupporter({
        _id: userDiscordId,
        guilds: ["old", "guild"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      await supporterModel.create(supporterToInsert);

      await supportersService.setGuilds(userDiscordId, guildIds);

      const found = await supporterModel.findById(userDiscordId);
      expect(found?.guilds).toEqual(guildIds);
    });

    it("returns the supporter with new guilds", async () => {
      const guildIds = ["1", "2"];
      const supporterToInsert = createTestSupporter({
        _id: userDiscordId,
        guilds: ["old", "guild"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      await supporterModel.create(supporterToInsert);

      const result = await supportersService.setGuilds(userDiscordId, guildIds);

      expect(result?.guilds).toEqual(guildIds);
    });
  });

  describe("isValidSupporter", () => {
    describe("when there is no patron", () => {
      it("returns true if there is no expiration date", () => {
        const supporter = {
          patrons: [],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns true if supporter is not expired yet", () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().add(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns false if supporter is expired", () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().subtract(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });
    });

    describe("when there is a patron", () => {
      it("returns true if there is one patron that is active and has a nonzero pledge", () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.ACTIVE,
              pledge: 1,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns true when declined, but last charge is within the past 4 days", () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.DECLINED,
              pledge: 100,
              lastCharge: dayjs().subtract(2, "day").toDate(),
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns false when they are a former patron", () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.FORMER,
              pledge: 0,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });

      it("returns false when declined and last charge is >4 days ago", () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.DECLINED,
              pledge: 0,
              lastCharge: dayjs().subtract(5, "day").toDate(),
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });

      it("returns true when there is at least 1 active patron in an array of patrons", () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.FORMER,
              pledge: 0,
            },
            {
              status: PatronStatus.ACTIVE,
              pledge: 1,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });
    });
  });
});
