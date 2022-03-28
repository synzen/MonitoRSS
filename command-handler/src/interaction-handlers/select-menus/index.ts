import { InteractionTask } from '../interaction-tasks.constants';
import RemoveFeedSelectMenu from './remove-feed';
import SelectMenusInterface from './select-menus.interface';
import SubAddUser from './sub-add-user';
import SubRemoveUser from './sub-remove-user';

const mapOfResponses = new Map<string, new () => SelectMenusInterface>([
  [InteractionTask.REMOVE_FEED, RemoveFeedSelectMenu],
  [InteractionTask.ADD_USER_FEED_SUBSCRIBER, SubAddUser],
  [InteractionTask.REMOVE_USER_FEED_SUBSCRIBER, SubRemoveUser],
]);

export default mapOfResponses;
