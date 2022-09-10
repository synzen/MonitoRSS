import { string, array, object } from "yup";
import { MediumPayload, mediumPayloadSchema } from "./medium-payload.type";

export interface FeedV2Event {
  feed: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  mediums: MediumPayload[];
}

export const feedV2EventSchema = object({
  feed: object({
    id: string().required(),
    url: string().required(),
    passingComparisons: array(string().required()),
    blockingComparisons: array(string().required()),
  }),
  mediums: array(mediumPayloadSchema.required()).min(1).required(),
});
