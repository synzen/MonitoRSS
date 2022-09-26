import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { FeedSubscribersService } from "./feed-subscribers.service";
import {
  FeedSubscriber,
  FeedSubscriberFeature,
  FeedSubscriberModel,
  FeedSubscriberType,
} from "./entities/feed-subscriber.entity";
import { createTestFeedSubscriber } from "../../test/data/subscriber.test-data";
import { Types } from "mongoose";

describe("FeedSubscribersService", () => {
  let service: FeedSubscribersService;
  let feedSubscriberModel: FeedSubscriberModel;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [FeedSubscribersService],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedSubscriberFeature]),
      ],
    });

    const { module } = await init();

    service = module.get<FeedSubscribersService>(FeedSubscribersService);
    feedSubscriberModel = module.get<FeedSubscriberModel>(
      getModelToken(FeedSubscriber.name)
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await feedSubscriberModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getSubscribersOfFeed", () => {
    it("returns the subscribers of the feed", async () => {
      const subscribers = [
        createTestFeedSubscriber({
          _id: new Types.ObjectId(),
        }),
        createTestFeedSubscriber({
          _id: new Types.ObjectId(),
        }),
      ];

      await feedSubscriberModel.create(subscribers);

      const found = await service.getSubscribersOfFeed(subscribers[0].feed);

      expect(found).toHaveLength(subscribers.length);
      expect(found).toEqual(
        expect.arrayContaining(
          subscribers.map((s) => expect.objectContaining(s))
        )
      );
    });
    it("sorts by createdAt descending", async () => {
      const subscribers = [
        createTestFeedSubscriber({
          _id: new Types.ObjectId(),
          id: "2020",
          createdAt: new Date(2020, 1, 1),
        }),
        createTestFeedSubscriber({
          _id: new Types.ObjectId(),
          id: "2017",
          createdAt: new Date(2017, 1, 2),
        }),
        createTestFeedSubscriber({
          _id: new Types.ObjectId(),
          id: "2025",
          createdAt: new Date(2025, 1, 2),
        }),
      ];

      await feedSubscriberModel.create(subscribers);
      // override mongoose's timestamp management
      await Promise.all(
        subscribers.map((s) =>
          feedSubscriberModel.collection.updateOne(
            {
              _id: s._id,
            },
            {
              $set: {
                createdAt: s.createdAt,
              },
            }
          )
        )
      );

      const found = await service.getSubscribersOfFeed(subscribers[0].feed);
      const foundIds = found.map((s) => s.id);
      expect(foundIds).toEqual(["2025", "2020", "2017"]);
    });
  });

  describe("createFeedSubscriber", () => {
    it("throws if the feedId is not a valid object id", async () => {
      const feedId = "invalid-id";

      await expect(
        service.createFeedSubscriber({
          feedId,
          discordId: "user-id",
          type: FeedSubscriberType.USER,
        })
      ).rejects.toThrow();
    });

    it("creates a new feed subscriber", async () => {
      const details = {
        discordId: "discord-id",
        type: FeedSubscriberType.ROLE,
        feedId: new Types.ObjectId().toHexString(),
      };
      await service.createFeedSubscriber(details);

      const found = await feedSubscriberModel.findOne(details);

      expect(found).toEqual(
        expect.objectContaining({
          type: details.type,
          id: details.discordId,
        })
      );
      expect(String(found?.feed)).toEqual(details.feedId);
    });

    it("returns the created subscriber", async () => {
      const details = {
        discordId: "discord-id",
        type: FeedSubscriberType.ROLE,
        feedId: new Types.ObjectId().toHexString(),
      };
      const created = await service.createFeedSubscriber(details);

      expect(created).toEqual(
        expect.objectContaining({
          type: details.type,
          id: details.discordId,
        })
      );
      expect(String(created?.feed)).toEqual(details.feedId);
    });
  });

  describe("remove", () => {
    it("removes the subscriber", async () => {
      const subscriber = createTestFeedSubscriber();
      await feedSubscriberModel.create(subscriber);

      await service.remove(subscriber._id);

      const found = await feedSubscriberModel.findOne(subscriber);

      expect(found).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns the subscriber", async () => {
      const subscriber = createTestFeedSubscriber({
        feed: new Types.ObjectId(),
        _id: new Types.ObjectId(),
      });
      await feedSubscriberModel.create(subscriber);

      const found = await service.findByIdAndFeed({
        subscriberId: subscriber._id,
        feedId: subscriber.feed,
      });

      expect(found).toEqual(
        expect.objectContaining({
          type: subscriber.type,
          id: subscriber.id,
        })
      );
      expect(String(found?.feed)).toEqual(subscriber.feed.toHexString());
    });

    it("returns null if not found", async () => {
      const found = await service.findByIdAndFeed({
        subscriberId: new Types.ObjectId(),
        feedId: new Types.ObjectId(),
      });

      expect(found).toBeNull();
    });
  });

  describe("updateOne", () => {
    describe("filters", () => {
      it("adds new filters properly if they do not exist", async () => {
        const subscriber = await feedSubscriberModel.create(
          createTestFeedSubscriber()
        );

        const updateObj = {
          filters: [
            {
              category: "title",
              value: "title-1",
            },
            {
              category: "description",
              value: "description-1",
            },
            {
              category: "title",
              value: "title-2",
            },
          ],
        };
        await service.updateOne(subscriber._id, updateObj);

        const found = await feedSubscriberModel.findOne(subscriber._id).lean();

        expect(found?.filters).toEqual({
          title: ["title-1", "title-2"],
          description: ["description-1"],
        });
      });

      it("does not save duplicate filters if they exist on the subscriber", async () => {
        const subscriber = createTestFeedSubscriber({
          filters: {
            title: ["title-1"],
          },
        });
        await feedSubscriberModel.create(subscriber);

        const updateObj = {
          filters: [
            {
              category: "title",
              value: "title-1",
            },
          ],
        };
        await service.updateOne(subscriber._id, updateObj);

        const found = await feedSubscriberModel.findOne(subscriber._id).lean();

        expect(found?.filters).toEqual({
          title: ["title-1"],
        });
      });

      it("does not save duplicate filters if they exist on the update object", async () => {
        const subscriber = await feedSubscriberModel.create(
          createTestFeedSubscriber()
        );

        const updateObj = {
          filters: [
            {
              category: "title",
              value: "title-1",
            },
            {
              category: "title",
              value: "title-1",
            },
          ],
        };
        await service.updateOne(subscriber._id, updateObj);

        const found = await feedSubscriberModel.findOne(subscriber._id).lean();

        expect(found?.filters).toEqual({
          title: ["title-1"],
        });
      });

      it("overwrites existing filters", async () => {
        const subscriber = createTestFeedSubscriber({
          filters: {
            title: ["title-1"],
          },
        });
        await feedSubscriberModel.create(subscriber);

        const updateObj = {
          filters: [
            {
              category: "title",
              value: "title-2",
            },
          ],
        };
        await service.updateOne(subscriber._id, updateObj);

        const found = await feedSubscriberModel.findOne(subscriber._id).lean();

        expect(found?.filters).toEqual({
          title: ["title-2"],
        });
      });

      it("returns the updated subscriber", async () => {
        const subscriber = await feedSubscriberModel.create(
          createTestFeedSubscriber()
        );

        const updateObj = {
          filters: [
            {
              category: "title",
              value: "title-1",
            },
          ],
        };
        const updated = await service.updateOne(subscriber._id, updateObj);

        expect(updated?.filters).toEqual({
          title: ["title-1"],
        });
      });
    });
  });
});
