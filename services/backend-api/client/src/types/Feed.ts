import { array, boolean, InferType, number, object, string } from "yup";
import { FeedConnectionSchema } from "./FeedConnection";
import { FeedEmbedSchema } from "./FeedEmbed";

export const FeedSchema = object({
  // From FeedSumarySchema, copied over since TypeScript doesn't work well with yup's .concat()
  id: string().required(),
  title: string().required(),
  status: string().oneOf(["ok", "failed", "disabled", "failing", "converted-to-user"]).required(),
  url: string().required(),
  channel: string().required(),
  createdAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  disabledReason: string().optional(),

  // Extra details
  failReason: string().optional(),
  filters: array(
    object({
      category: string().required(),
      value: string().required(),
    }),
  ).required(),
  refreshRateSeconds: number().required(),
  text: string().defined(),
  embeds: array(FeedEmbedSchema).required(),
  checkTitles: boolean().required(),
  checkDates: boolean().required(),
  imgPreviews: boolean().required(),
  imgLinksExistence: boolean().required(),
  formatTables: boolean().required(),
  directSubscribers: boolean().required(),
  splitMessage: boolean().required(),
  ncomparisons: array(string().required()).required(),
  pcomparisons: array(string().required()).required(),
  webhook: object({
    id: string().required(),
    name: string().optional(),
    iconUrl: string().optional(),
  }).optional(),
  isFeedv2: boolean().optional().default(false),
  connections: array(FeedConnectionSchema.required()).optional(),
});

export type Feed = InferType<typeof FeedSchema>;
