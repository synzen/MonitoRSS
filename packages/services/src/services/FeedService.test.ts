import 'reflect-metadata';
import FeedService from './FeedService';

describe('FeedService', () => {
  let service: FeedService;
  let models = {
    Feed: {
      countInGuild: jest.fn(),
      findByField: jest.fn(),
      insert: jest.fn(),
      removeById: jest.fn(),
      find: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FeedService( models as any);
  });

  describe('findByGuild', () => {
    it('returns the found feeds of the guild', async () => {
      models.Feed.findByField.mockResolvedValue([{
        id: '1',
      }, {
        id: '2',
      }]);

      const feeds = await service.findByGuild('123');

      expect(feeds).toEqual([{
        id: '1',
      }, {
        id: '2',
      }]);
    });
  });

  describe('find', () =>{ 
    it('returns the found feeds', async () => {
      const foundFeeds = [{
        id: '1',
      }, {
        id: '2',
      }];

      models.Feed.find.mockResolvedValue(foundFeeds);
      const feeds = await service.find({});
      expect(feeds).toEqual(foundFeeds);
    });
  });

  describe('removeOne', () => {
    it('removes the feed by id', async () => {
      await service.removeOne('123');
      expect(models.Feed.removeById).toHaveBeenCalledTimes(1);
    });
  });
});
