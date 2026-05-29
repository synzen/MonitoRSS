import { MessageComponentRoot } from "../../messageBuilder/types";
import { DetectedFields, TemplateRequiredField } from "./DetectedFields";

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  ThumbnailComponent?: React.FC;
  requiredFields: TemplateRequiredField[];
  requiredFieldsOr?: TemplateRequiredField[];
  createMessageComponent: (fields?: DetectedFields) => MessageComponentRoot;
}
