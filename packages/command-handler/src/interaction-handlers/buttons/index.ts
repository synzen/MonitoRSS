import { InteractionTasks } from '../../types/interaction-custom-id.type';
import ButtonsInterface from './buttons.interface';
import ResponseListFeeds from './list-feeds';

const mapOfResponses = new Map<string, new () => ButtonsInterface>([
  [InteractionTasks.ON_CLICK_NEXT_PAGE, ResponseListFeeds],
  [InteractionTasks.ON_CLICK_PREVIOUS_PAGE, ResponseListFeeds],
]);

export default mapOfResponses;
