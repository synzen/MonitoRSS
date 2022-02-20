import { FeedArticle } from '../../types/FeedArticle';

const mockFeedArticles: FeedArticle[] = [{
  placeholders: [{
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
}];

export default mockFeedArticles;
