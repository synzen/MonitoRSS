import {
  array, boolean, InferType, number, object, string,
} from 'yup';

const FeedEmbed = object({
  title: string().optional(),
  description: string().optional(),
  url: string().optional(),
  timestamp: string().oneOf(['now', 'article']).optional(),
  footer: object({
    text: string().optional(),
    iconUrl: string().optional(),
  }).optional(),
  thumbnail: object({
    url: string().optional(),
  }).optional(),
  image: object({
    url: string().optional(),
  }).optional(),
  author: object({
    name: string().optional(),
    url: string().optional(),
    iconUrl: string().optional(),
  }).optional(),
  color: number().optional(),
  fields: array(object({
    name: string(),
    value: string(),
    inline: boolean().optional(),
  })).optional(),
  ncomparisons: array(string()).optional(),
  pcomparisons: array(string()).optional(),
}).required();

export const FeedSchema = object({
  // From FeedSumarySchema, copied over since TypeScript doesn't work well with yup's .concat()
  id: string().required(),
  title: string().required(),
  status: string().oneOf(['ok', 'failed']).required(),
  url: string().required(),
  channel: string().required(),
  createdAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),

  // Extra details
  failReason: string().optional(),
  refreshRateSeconds: number().required(),
  text: string().defined(),
  embeds: array(FeedEmbed).required(),
  checkTitles: boolean().optional(),
  checkDates: boolean().optional(),
  imgPreviews: boolean().optional(),
  imgLinksExistence: boolean().optional(),
  formatTables: boolean().optional(),
  directSubscribers: boolean().optional(),
  disabled: string().optional(),
});

export type Feed = InferType<typeof FeedSchema>;
