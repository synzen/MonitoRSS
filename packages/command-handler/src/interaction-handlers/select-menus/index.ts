import { InteractionTasks } from '../../types/interaction-custom-id.type';
import RemoveFeedSelectMenu from './remove-feed';
import SelectMenusInterface from './select-menus.interface';

const mapOfResponses = new Map<string, new () => SelectMenusInterface>([
  [InteractionTasks.REMOVE_FEED, RemoveFeedSelectMenu],
]);

export default mapOfResponses;
