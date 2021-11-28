import { InteractionTasks } from '../types/interaction-custom-id.type';
import ResponseListFeeds from './list-feeds';
import ResponseRemoveFeed from './remove-feed';
import ResponseInterface from './response.interface';

const mapOfResponses = new Map<string, new () => ResponseInterface>([
  [ResponseRemoveFeed.TASK_ID, ResponseRemoveFeed],
  [ResponseListFeeds.TASK_ID, ResponseListFeeds],
  [InteractionTasks.ON_CLICK_NEXT_PAGE, ResponseListFeeds],
  [InteractionTasks.ON_CLICK_PREVIOUS_PAGE, ResponseListFeeds],
]);

export default mapOfResponses;
