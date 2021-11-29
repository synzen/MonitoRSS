import InteractionCustomId from '../interaction-handlers/interaction-custom-id.type';

function parseInteractionCustomId<T>(data: string): InteractionCustomId<T> | null {
  try {
    const customIdObject = JSON.parse(data);

    return {
      finalTask: customIdObject.finalTask,
      task: customIdObject.task,
      data: customIdObject.data,
      executeFinalTask: customIdObject.executeFinalTask,
    };
  } catch (error) {
    return null;
  }
}

export default parseInteractionCustomId;
 
