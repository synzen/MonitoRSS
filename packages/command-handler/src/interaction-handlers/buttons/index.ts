import { InteractionTasks } from '../../types/interaction-custom-id.type';
import ButtonsInterface from './buttons.interface';
import FeedListPageChangeButton from './feed-list-page-change';

const mapOfResponses = new Map<string, new () => ButtonsInterface>([
  [InteractionTasks.ON_CLICK_NEXT_PAGE, FeedListPageChangeButton],
  [InteractionTasks.ON_CLICK_PREVIOUS_PAGE, FeedListPageChangeButton],
]);

export default mapOfResponses;
