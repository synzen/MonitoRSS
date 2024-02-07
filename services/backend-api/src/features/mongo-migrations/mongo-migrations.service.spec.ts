import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { TestingModule } from "@nestjs/testing";
import { Types } from "mongoose";
import { CustomPlaceholderStepType } from "../../common/constants/custom-placeholder-step-type.constants";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";

import {
  UserFeed,
  UserFeedFeature,
  UserFeedModel,
} from "../user-feeds/entities";
import {
  MongoMigration,
  MongoMigrationModel,
} from "./entities/mongo-migration.entity";

import { MongoMigrationsModule } from "./mongo-migrations.module";
import { MongoMigrationsService } from "./mongo-migrations.service";

describe("MongoDB Migrations Service", () => {
  let module: TestingModule;
  let userFeedModel: UserFeedModel;
  let migrationModel: MongoMigrationModel;
  let service: MongoMigrationsService;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
        MongoMigrationsModule,
      ],
    });

    ({ module } = await init());
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    migrationModel = module.get<MongoMigrationModel>(
      getModelToken(MongoMigration.name)
    );
    service = module.get<MongoMigrationsService>(MongoMigrationsService);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await userFeedModel.deleteMany();
    await migrationModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module?.close();
  });

  describe("applyMigrations", () => {
    it("should apply custom-placeholder-steps", async () => {
      await userFeedModel.collection.insertOne({
        url: "https://example.com",
        feedRequestLookupKey: "https://example.com",
        title: "title",
        user: {
          discordUserId: "user",
        },
        connections: {
          discordChannels: [
            {
              id: new Types.ObjectId().toHexString(),
              createdAt: new Date(),
              updatedAt: new Date(),
              name: "name",
              details: {
                embeds: [],
                formatter: {},
              },
              customPlaceholders: [
                {
                  id: new Types.ObjectId().toHexString(),
                  steps: [
                    {
                      regexSearch: "search",
                      regexSearchFlags: "gmi",
                    },
                  ],
                  sourcePlaceholder: "source",
                  referenceName: "reference",
                },
              ],
            },
          ],
        },
      });

      await service.applyMigrations();

      const feed = await userFeedModel.findOne({}).lean();

      expect(
        feed?.connections.discordChannels?.[0]?.customPlaceholders?.[0]
          ?.steps?.[0]
      ).toEqual({
        id: expect.anything(),
        regexSearch: "search",
        regexSearchFlags: "gmi",
        type: CustomPlaceholderStepType.Regex,
      });
    });

    it("should create the migration documents", async () => {
      await service.applyMigrations();

      const migrations = await migrationModel.find({});

      expect(migrations).toHaveLength(service.MIGRATIONS_LIST.length);
      const ids = migrations.map((m) => m.id);

      expect(ids).toEqual(service.MIGRATIONS_LIST.map((m) => m.id));
    });
  });
});
