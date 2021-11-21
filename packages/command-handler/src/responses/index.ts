import ResponseRemoveFeed from './remove-feed';
import ResponseInterface from './response.interface';

const mapOfResponses = new Map<string, new () => ResponseInterface>([
  [ResponseRemoveFeed.customId, ResponseRemoveFeed],
]);

export default mapOfResponses;
