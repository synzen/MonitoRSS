import { InferType, bool, number, object, string } from "yup";

export const DeliveryRateLimitSchema = object({
  id: string().required("This is a required field"),
  isNew: bool(), // Just used on client side to see what is new
  limit: number()
    .required("This is a required field")
    .positive("Must be positive")
    .integer("Must be an integer"),
  timeWindowSeconds: number()
    .required("This is a required field")
    .positive("Must be positive")
    .integer("Must be an integer"),
});

export type DeliveryRateLimit = InferType<typeof DeliveryRateLimitSchema>;
