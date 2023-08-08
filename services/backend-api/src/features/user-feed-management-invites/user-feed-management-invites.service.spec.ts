import { NotFoundException } from "@nestjs/common";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { FeedLimitReachedException } from "../feeds/exceptions";
import { SupportersService } from "../supporters/supporters.service";
import {
  UserFeed,
  UserFeedFeature,
  UserFeedModel,
} from "../user-feeds/entities";
import { UserFeedsService } from "../user-feeds/user-feeds.service";
import { UserFeedManagerStatus } from "./constants";
import { UserFeedManagementInvitesService } from "./user-feed-management-invites.service";

const discordUserId = "discordUserId";

describe("UserFeedManagementInvitesService", () => {
  let service: UserFeedManagementInvitesService;
  let userFeedModel: UserFeedModel;
  const userFeedsService = {
    calculateCurrentFeedCountOfDiscordUser: jest.fn(),
  };
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
  };

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        UserFeedManagementInvitesService,
        UserFeedsService,
        SupportersService,
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
      ],
    });

    uncompiledModule
      .overrideProvider(UserFeedsService)
      .useValue(userFeedsService)
      .overrideProvider(SupportersService)
      .useValue(supportersService);

    const { module } = await init();
    service = module.get(UserFeedManagementInvitesService);
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    userFeedsService.calculateCurrentFeedCountOfDiscordUser.mockResolvedValue(
      0
    );
    supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
      maxUserFeeds: 100,
    });
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await userFeedModel?.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  describe("createInvite", () => {
    let feed: UserFeed;

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title1",
        url: "url",
        user: {
          discordUserId,
        },
      });
    });

    it("creates the invite", async () => {
      const targetDiscordUserId = "targetDiscordUserId";
      await service.createInvite({
        feed,
        targetDiscordUserId,
      });

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites).toMatchObject([
        {
          id: expect.any(Types.ObjectId),
          discordUserId: targetDiscordUserId,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          status: UserFeedManagerStatus.Pending,
        },
      ]);
    });
  });

  describe("getUserFeedOfInviteWithOwner", () => {
    let feed: UserFeed;
    const inviteId = new Types.ObjectId();

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title1",
        url: "url",
        user: {
          discordUserId,
        },
        shareManageOptions: {
          invites: [
            {
              id: inviteId,
              discordUserId: "discordUserId",
              createdAt: new Date(),
              updatedAt: new Date(),
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });
    });

    it("returns the feed", async () => {
      const result = await service.getUserFeedOfInviteWithOwner(
        inviteId.toHexString(),
        discordUserId
      );

      expect(result).toMatchObject({
        _id: feed._id,
        title: feed.title,
        url: feed.url,
        user: {
          discordUserId,
        },
        shareManageOptions: {
          invites: [
            {
              id: inviteId,
              discordUserId: "discordUserId",
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });
    });

    it("does not return the feed if the invite id does not match", async () => {
      const result = await service.getUserFeedOfInviteWithOwner(
        new Types.ObjectId().toHexString(),
        discordUserId
      );

      expect(result).toBeNull();
    });

    it("does not return the feed if the discord user id does not match", async () => {
      const result = await service.getUserFeedOfInviteWithOwner(
        inviteId.toHexString(),
        "otherDiscordUserId"
      );

      expect(result).toBeNull();
    });
  });

  describe("deleteInvite", () => {
    let feed: UserFeed;
    const inviteId = new Types.ObjectId();

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title1",
        url: "url",
        user: {
          discordUserId,
        },
        shareManageOptions: {
          invites: [
            {
              id: inviteId,
              discordUserId: "discordUserId",
              createdAt: new Date(),
              updatedAt: new Date(),
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });
    });

    it("deletes the invite", async () => {
      await service.deleteInvite(feed._id, inviteId.toHexString());

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites).toHaveLength(0);
    });

    it("does not delete the invite if the invite id does not match", async () => {
      await service.deleteInvite(feed._id, new Types.ObjectId().toHexString());

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites).toHaveLength(1);
    });

    it("does not delete the invite if the feed id does not match", async () => {
      await service.deleteInvite(new Types.ObjectId(), inviteId.toHexString());

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites).toHaveLength(1);
    });
  });

  describe("updateInvite", () => {
    let feed: UserFeed;
    const inviteId = new Types.ObjectId();

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title1",
        url: "url",
        user: {
          discordUserId,
        },
        shareManageOptions: {
          invites: [
            {
              id: inviteId,
              discordUserId: "discordUserId",
              createdAt: new Date(),
              updatedAt: new Date(),
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });
    });

    it("updates the invite status", async () => {
      await service.updateInvite(
        feed,
        inviteId.toHexString(),
        "discordUserId",
        {
          status: UserFeedManagerStatus.Declined,
        }
      );

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites[0].status).toEqual(
        UserFeedManagerStatus.Declined
      );
    });

    it("does not update the invite status if there is nothing to update", async () => {
      await service.updateInvite(
        feed,
        inviteId.toHexString(),
        "discordUserId",
        {}
      );

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites[0]).toMatchObject({
        id: inviteId,
        discordUserId: "discordUserId",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: UserFeedManagerStatus.Pending,
      });
    });

    it("throws if user will exceed feed limit", async () => {
      userFeedsService.calculateCurrentFeedCountOfDiscordUser.mockResolvedValue(
        100
      );
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        maxUserFeeds: 100,
      });

      await expect(
        service.updateInvite(feed, inviteId.toHexString(), "discordUserId", {})
      ).rejects.toThrow(FeedLimitReachedException);
    });
  });

  describe("resendInvite", () => {
    let feed: UserFeed;
    const inviteId = new Types.ObjectId();

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "title1",
        url: "url",
        user: {
          discordUserId,
        },
        shareManageOptions: {
          invites: [
            {
              id: inviteId,
              discordUserId: "discordUserId",
              createdAt: new Date(),
              updatedAt: new Date(),
              status: UserFeedManagerStatus.Declined,
            },
          ],
        },
      });
    });

    it("updates the invite status", async () => {
      await service.resendInvite(feed._id, inviteId.toHexString());

      const updatedFeed = await userFeedModel
        .findById(feed._id)
        .select("shareManageOptions")
        .lean();

      expect(updatedFeed?.shareManageOptions?.invites[0].status).toEqual(
        UserFeedManagerStatus.Pending
      );
    });

    it("throws if if the invite id does not match", async () => {
      await expect(
        service.resendInvite(feed._id, new Types.ObjectId().toHexString())
      ).rejects.toThrow(NotFoundException);
    });

    it("throws if the feed id does not match", async () => {
      await expect(
        service.resendInvite(new Types.ObjectId(), inviteId.toHexString())
      ).rejects.toThrow(NotFoundException);
    });
  });
});
