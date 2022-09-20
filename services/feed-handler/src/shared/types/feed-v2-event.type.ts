import { string, array, object, number } from "yup";
import { MediumPayload, mediumPayloadSchema } from "./medium-payload.type";

export interface FeedV2Event {
  feed: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  mediums: MediumPayload[];
  articleDayLimit: number;
}

export const feedV2EventSchema = object({
  feed: object({
    id: string().required(),
    url: string().required(),
    passingComparisons: array(string().required()),
    blockingComparisons: array(string().required()),
  }),
  mediums: array(mediumPayloadSchema.required()).min(1).required(),
  // Field should eventually be deprecated in favour of getting it from some source of truth
  articleDayLimit: number().required(),
});
