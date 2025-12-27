import { MessageComponentRoot } from "../../../pages/MessageBuilder/types";

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  requiredFields: string[];
  createMessageComponent: (imageField?: string) => MessageComponentRoot;
}
