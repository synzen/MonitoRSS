import { createTestFeedSubscriber } from '../../../test/data/subscriber.test-data';
import { CreateFeedSubscriberOutputDto } from './CreateFeedSubscriberOutput.dto';

describe('CreateFeedSubscriberOutputDto', () => {
  it('returns the formatted result', () => {
    const entity = createTestFeedSubscriber({
      filters: {
        title: ['hello', 'hello2'],
        description: ['world'],
      },
    });
    const formatted = CreateFeedSubscriberOutputDto.fromEntity(entity);

    expect(formatted).toEqual({
      result: {
        id: entity._id.toHexString(),
        discordId: entity.id,
        feed: entity.feed.toHexString(),
        type: entity.type,
        filters: [
          {
            category: 'description',
            value: 'world',
          },
          {
            category: 'title',
            value: 'hello',
          },
          {
            category: 'title',
            value: 'hello2',
          },
        ],
      },
    });
  });
});
