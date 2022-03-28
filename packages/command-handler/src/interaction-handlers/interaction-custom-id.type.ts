import { InteractionTask } from './interaction-tasks.constants';

export interface InteractionPaginationData {
  pageNumber: number
}

export interface InteractionCustomIdPayload<Data extends Record<string, any>> {
  ft: InteractionTask;
  t: InteractionTask;
  d?: Data;
  eft?: boolean;
}

export interface InteractionCustomIdParsed<Data extends Record<string, any>> {
  finalTask: InteractionTask;
  task: InteractionTask;
  data?: Data;
  executeFinalTask?: boolean;
}
