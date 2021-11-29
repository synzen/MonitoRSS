import { InteractionTask } from './interaction-tasks.constants';

export interface InteractionPaginationData {
  pageNumber: number
}

interface InteractionCustomId<Data extends Record<string, any>> {
  finalTask: InteractionTask;
  task: InteractionTask;
  data?: Data;
  executeFinalTask?: boolean;
}

export default InteractionCustomId;
