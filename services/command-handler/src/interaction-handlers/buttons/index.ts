import { InteractionTask } from '../interaction-tasks.constants';
import ButtonsInterface from './buttons.interface';
import FeedListPageChangeButton from './feed-list-page-change';

const mapOfResponses = new Map<string, new () => ButtonsInterface>([
  [InteractionTask.ON_CLICK_NEXT_PAGE, FeedListPageChangeButton],
  [InteractionTask.ON_CLICK_PREVIOUS_PAGE, FeedListPageChangeButton],
]);

export default mapOfResponses;
