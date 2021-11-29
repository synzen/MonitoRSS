import InteractionCustomId from '../interaction-handlers/interaction-custom-id.type';

function createInteractionCustomId<T>(data: InteractionCustomId<T>): string {
  return JSON.stringify(data);
}

export default createInteractionCustomId;
 
