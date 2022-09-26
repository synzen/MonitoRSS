import { createTestFeedSubscriber } from "../../../test/data/subscriber.test-data";
import { GetFeedOutputDto } from "./GetFeedOutput.dto";
import { UpdateFeedSubscriberOutputDto } from "./UpdateFeedSubscriberOutput.dto";

describe("UpdateFeedSubscriberOutputDto", () => {
  beforeAll(() => {
    jest.resetAllMocks();
  });

  describe("fromEntity", () => {
    it("returns the formatted dto object", () => {
      const subscriber = createTestFeedSubscriber();

      const result = UpdateFeedSubscriberOutputDto.fromEntity(subscriber);

      jest.spyOn(GetFeedOutputDto, "getFeedFiltersDto").mockReturnValue([]);

      expect(result).toEqual({
        result: {
          id: subscriber._id.toHexString(),
          filters: [],
          discordId: subscriber.id,
          type: subscriber.type,
          feed: subscriber.feed.toHexString(),
        },
      });
    });
  });
});
