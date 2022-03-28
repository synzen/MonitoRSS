import { FeedArticle } from '../../features/feed/types/FeedArticle';

const mockFeedArticles: FeedArticle[] = [{
  id: '1',
  title: 'Daily News Report',
  placeholders: {
    public: [{
      name: 'title',
      value: 'My Feed',
    }, {
      name: 'description',
      value: 'This is a description',
    }, {
      name: 'url',
      value: 'https://www.example.com',
    }, {
      name: 'image1',
      value: 'https://www.example.com/image1.png',
    }, {
      name: 'image2',
      value: 'https://www.example.com/image2.png',
    }, {
      name: 'image3',
      value: 'https://www.example.com/image3.png',
    }],
    private: [],
    raw: [],
    regex: [],
  },
}];

export default mockFeedArticles;
