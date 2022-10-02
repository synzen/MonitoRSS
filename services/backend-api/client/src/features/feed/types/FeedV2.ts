import {
  array, bool, InferType,
} from 'yup';
import { FeedSchema, FeedConnectionSchema } from '@/types';

export const FeedV2Schema = FeedSchema.shape({
  connections: array(FeedConnectionSchema.required()).required(),
  isFeedv2: bool().oneOf([true]).required(),
});

export type Feed = InferType<typeof FeedSchema>;
