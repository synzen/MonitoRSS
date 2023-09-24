import { InferType, number, object } from "yup";

export const mediumRateLimitSchema = object({
  timeWindowSeconds: number().required(),
  limit: number().required(),
});

export type MediumRateLimit = InferType<typeof mediumRateLimitSchema>;
