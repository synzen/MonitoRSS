import { createTestFeed } from "../../test/data/feeds.test-data";
import { FEED_DISABLED_LEGACY_CODES } from "./constants";
import { UpdateFeedInputDto } from "./dto/update-feed-input.dto";
import { FeedsController } from "./feeds.controller";
import { DetailedFeed } from "./types/detailed-feed.type";
import { FeedStatus } from "./types/FeedStatus.type";

describe("FeedsController", () => {
  const feedsService = {
    updateOne: jest.fn(),
    refresh: jest.fn(),
    enableFeed: jest.fn(),
  };
  const feedFetcherService = {
    fetchFeed: jest.fn(),
  };
  const supportersService = {
    serverCanUseWebhooks: jest.fn(),
  };
  const webhooksService = {
    getWebhook: jest.fn(),
  };
  let controller: FeedsController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new FeedsController(
      feedsService as never,
      feedFetcherService as never,
      supportersService as never,
      webhooksService as never
    );
  });

  describe("updateFeed", () => {
    const feed: DetailedFeed = {
      ...createTestFeed(),
      refreshRateSeconds: 10,
      status: FeedStatus.OK,
    };

    beforeEach(() => {
      feedsService.updateOne.mockResolvedValue(feed);
    });

    it("enables feed if text or embed is updated, and was disabled from bad format", async () => {
      const updateFeedInputDto: UpdateFeedInputDto = {
        text: "new text",
      };

      jest.spyOn(feedsService, "updateOne").mockResolvedValue({
        ...feed,
        disabled: FEED_DISABLED_LEGACY_CODES.BAD_FORMAT,
      });

      await controller.updateFeed(feed, updateFeedInputDto);

      expect(feedsService.enableFeed).toHaveBeenCalledWith(
        feed._id.toHexString()
      );
    });

    it("does not enable feeds with bad format if text or embed is not updated", async () => {
      const updateFeedInputDto: UpdateFeedInputDto = {};

      jest.spyOn(feedsService, "updateOne").mockResolvedValue({
        ...feed,
        disabled: FEED_DISABLED_LEGACY_CODES.BAD_FORMAT,
      });

      await controller.updateFeed(feed, updateFeedInputDto);

      expect(feedsService.enableFeed).not.toHaveBeenCalled();
    });

    describe("channelId", () => {
      it("should update the feed with the channelId", async () => {
        const input: UpdateFeedInputDto = {
          channelId: "123",
        };

        await controller.updateFeed(feed, input);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            channelId: input.channelId,
          })
        );
      });
    });

    describe("title", () => {
      it("calls update with the title", async () => {
        const title = "new-title";
        await controller.updateFeed(feed, {
          title,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            title,
          })
        );
      });
    });

    describe("ncomparisons", () => {
      it("calls update with the ncomparisons", async () => {
        const ncomparisons = ["title"];
        await controller.updateFeed(feed, {
          ncomparisons,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            ncomparisons,
          })
        );
      });
    });

    describe("pcomparisons", () => {
      it("calls update with the pcomparisons", async () => {
        const pcomparisons = ["title"];
        await controller.updateFeed(feed, {
          pcomparisons,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            pcomparisons,
          })
        );
      });
    });

    describe("filters", () => {
      it("calls update with undefined filters if there are no filters", async () => {
        const updateDto: UpdateFeedInputDto = {};

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: undefined,
          })
        );
      });

      it("calls update with the filters array converted to an object", async () => {
        const updateDto: UpdateFeedInputDto = {
          filters: [
            {
              category: "title",
              value: "title",
            },
            {
              category: "title",
              value: "title2",
            },
            {
              category: "description",
              value: "desc",
            },
          ],
        };

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: { title: ["title", "title2"], description: ["desc"] },
          })
        );
      });

      it("does not include duplicates", async () => {
        const updateDto: UpdateFeedInputDto = {
          filters: [
            {
              category: "title",
              value: "title",
            },
            {
              category: "title",
              value: "title",
            },
            {
              category: "title",
              value: "newtitle",
            },
          ],
        };

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: { title: ["title", "newtitle"] },
          })
        );
      });

      it("trims the values", async () => {
        const updateDto: UpdateFeedInputDto = {
          filters: [
            {
              category: "title",
              value: "title                          ",
            },
          ],
        };

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: { title: ["title"] },
          })
        );
      });
    });
  });
});
