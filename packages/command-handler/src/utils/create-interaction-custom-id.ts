import InteractionCustomId from '../types/interaction-custom-id.type';

function createInteractionCustomId<T>(data: InteractionCustomId<T>): string {
  const customIdObject = {
    action: data.action,
    task: data.task,
    data: data.data,
  };

  return JSON.stringify(customIdObject);
}

export default createInteractionCustomId;
 
