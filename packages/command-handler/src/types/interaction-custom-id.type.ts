/**
 * Task - The purpose of the interaction
 * Action - The action to take when the interaction is clicked
 */

export enum InteractionActions {
  REMOVE_FEED = 'REMOVE_FEED',
}

export enum InteractionTasks {
  LIST_FEEDS = 'LIST_FEEDS',
  ON_CLICK_PREVIOUS_PAGE = 'ON_CLICK_PREVIOUS_PAGE',
  ON_CLICK_NEXT_PAGE = 'ON_CLICK_NEXT_PAGE',
}

export interface InteractionPaginationData {
  pageNumber: number
}

interface InteractionCustomId<Data extends Record<string, any>> {
  action: InteractionActions;
  task: InteractionTasks;
  data?: Data
}

export default InteractionCustomId;
