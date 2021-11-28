import InteractionCustomId from '../types/interaction-custom-id.type';

function parseInteractionCustomId<T>(data: string): InteractionCustomId<T> | null {
  try {
    const customIdObject = JSON.parse(data);

    return {
      action: customIdObject.action,
      task: customIdObject.task,
      data: customIdObject.data,
    };
  } catch (error) {
    return null;
  }
}

export default parseInteractionCustomId;
 
