import { MessageComponentRoot } from "../../../pages/MessageBuilder/types";

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  ThumbnailComponent?: React.FC;
  requiredFields: string[];
  createMessageComponent: (imageField?: string) => MessageComponentRoot;
}
