import { InferType, array, object } from "yup";
import { DeliveryRateLimitSchema } from "../../../../../types/DeliveryRateLimit";

export const DeliveryRateLimitsFormSchema = object({
  rateLimits: array(DeliveryRateLimitSchema.required()).required(),
});

export type DeliveryRateLimitsFormData = InferType<typeof DeliveryRateLimitsFormSchema>;
