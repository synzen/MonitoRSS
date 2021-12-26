import {
  InteractionCustomIdParsed,
  InteractionCustomIdPayload,
} from '../interaction-handlers/interaction-custom-id.type';

function parseInteractionCustomId<T>(data: string): InteractionCustomIdParsed<T> | null {
  try {
    const customIdObject = JSON.parse(data) as InteractionCustomIdPayload<T>;

    return {
      finalTask: customIdObject.ft,
      task: customIdObject.t,
      data: customIdObject.d,
      executeFinalTask: customIdObject.eft,
    };
  } catch (error) {
    return null;
  }
}

export default parseInteractionCustomId;
 
