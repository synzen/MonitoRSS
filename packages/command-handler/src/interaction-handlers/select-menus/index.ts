import { InteractionTask } from '../interaction-tasks.constants';
import RemoveFeedSelectMenu from './remove-feed';
import SelectMenusInterface from './select-menus.interface';

const mapOfResponses = new Map<string, new () => SelectMenusInterface>([
  [InteractionTask.REMOVE_FEED, RemoveFeedSelectMenu],
]);

export default mapOfResponses;
