import { string, array, object, number } from "yup";
import { MediumPayload, mediumPayloadSchema } from "./medium-payload.type";
import { UserFeedFormatOptions } from "./user-feed-format-options.type";

export interface FeedV2Event {
  data: {
    feed: {
      id: string;
      url: string;
      passingComparisons: string[];
      blockingComparisons: string[];
      formatOptions?: UserFeedFormatOptions;
    };
    mediums: MediumPayload[];
    articleDayLimit: number;
  };
}

export const feedV2EventSchema = object({
  data: object({
    feed: object({
      id: string().required(),
      url: string().required(),
      passingComparisons: array(string().required()).required(),
      blockingComparisons: array(string().required()).required(),
      formatOptions: object({
        dateFormat: string().optional(),
      }).optional(),
    }),
    mediums: array(mediumPayloadSchema.required()).min(1).required(),
    // Field should eventually be deprecated in favour of getting it from some source of truth
    articleDayLimit: number().required(),
  }),
});
