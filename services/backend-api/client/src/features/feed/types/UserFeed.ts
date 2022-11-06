import {
  array, InferType, number, object, string,
} from 'yup';
import { FeedConnectionSchema } from '../../../types';
import { UserFeedDisabledCode } from './UserFeedDisabledCode';
import { UserFeedHealthStatus } from './UserFeedHealthStatus';

export const UserFeedSchema = object({
  id: string().required(),
  title: string().required(),
  url: string().required(),
  createdAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  updatedAt: string().transform((value) => (value ? new Date(value).toISOString() : value)),
  disabledCode: string().oneOf(Object.values(UserFeedDisabledCode)).optional(),
  healthStatus: string().oneOf(Object.values(UserFeedHealthStatus)).required(),
  connections: array(FeedConnectionSchema).required(),
  refreshRateSeconds: number().required(),
});

export type UserFeed = InferType<typeof UserFeedSchema>;
