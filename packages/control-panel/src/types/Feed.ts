import { z } from 'zod';
import { FeedSummarySchema } from './FeedSummary';

const FeedEmbed = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.enum(['now', 'article']).optional(),
  footer: z.object({
    text: z.string().optional(),
    iconUrl: z.string().optional(),
  }).optional(),
  thumbnail: z.object({
    url: z.string().optional(),
  }).optional(),
  image: z.object({
    url: z.string().optional(),
  }).optional(),
  author: z.object({
    name: z.string().optional(),
    url: z.string().optional(),
    iconUrl: z.string().optional(),
  }).optional(),
  color: z.number().optional(),
  fields: z.array(z.object({
    name: z.string().optional(),
    value: z.string().optional(),
    inline: z.boolean().optional(),
  })).optional(),
  checkTitle: z.boolean().optional(),
  checkDates: z.boolean().optional(),
  imgPreviews: z.boolean().optional(),
  imgLinksExistence: z.boolean().optional(),
  formatTables: z.boolean().optional(),
  directSubscribers: z.boolean().optional(),
  disabled: z.string().optional(),
  ncomparisons: z.array(z.string()).optional(),
  pcomparisons: z.array(z.string()).optional(),
});

export const FeedSchema = FeedSummarySchema.merge(z.object({
  text: z.string(),
  embeds: z.array(FeedEmbed),
}));

export type Feed = z.infer<typeof FeedSchema>;
