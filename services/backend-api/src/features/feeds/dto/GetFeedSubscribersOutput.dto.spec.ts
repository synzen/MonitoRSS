import { createTestFeedSubscriber } from '../../../test/data/subscriber.test-data';
import { GetFeedOutputDto } from './GetFeedOutput.dto';
import { GetFeedSubscribersOutputDto } from './GetFeedSubscribersOutput.dto';

describe('GetFeedSubscribersOutputDto', () => {
  beforeAll(() => {
    jest.resetAllMocks();
  });

  describe('fromEntity', () => {
    it('returns the formatted dto object', () => {
      const subscribers = [createTestFeedSubscriber()];

      const result = GetFeedSubscribersOutputDto.fromEntity(subscribers);

      jest.spyOn(GetFeedOutputDto, 'getFeedFiltersDto').mockReturnValue([]);

      expect(result).toEqual({
        results: [
          {
            id: subscribers[0]._id.toHexString(),
            filters: [],
            discordId: subscribers[0].id,
            type: subscribers[0].type,
            feed: subscribers[0].feed.toHexString(),
          },
        ],
        total: subscribers.length,
      });
    });
  });
});
