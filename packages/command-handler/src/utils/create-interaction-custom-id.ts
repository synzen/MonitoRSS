import { 
  InteractionCustomIdParsed,
  InteractionCustomIdPayload,
} from '../interaction-handlers/interaction-custom-id.type';

function createInteractionCustomId<T>(data: InteractionCustomIdParsed<T>): string {
  const payload: InteractionCustomIdPayload<T> = {
    d: data.data,
    ft: data.finalTask,
    t: data.task,
    eft: data.executeFinalTask,
  };

  return JSON.stringify(payload);
}

export default createInteractionCustomId;
 
