import { InteractionTasks } from '../../types/interaction-custom-id.type';
import ResponseRemoveFeed from './remove-feed';
import SelectMenusInterface from './select-menus.interface';

const mapOfResponses = new Map<string, new () => SelectMenusInterface>([
  [InteractionTasks.REMOVE_FEED, ResponseRemoveFeed],
]);

export default mapOfResponses;
