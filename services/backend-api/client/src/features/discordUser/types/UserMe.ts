import { InferType, bool, object, string } from "yup";

export const UserMeSchema = object({
  id: string().required(),
  email: string(),
  preferences: object({
    alertOnDisabledFeeds: bool().default(false),
  }).default({}),
  subscription: object({
    product: object({
      key: string().required(),
      name: string().required(),
    }).required(),
    status: string().oneOf(["ACTIVE", "CANCELLED", "PAST_DUE", "PAUSED"]).required(),
    nextBillDate: string().nullable(),
    cancellationDate: string().nullable(),
    billingInterval: string().oneOf(["month", "year"]).nullable(),
    billingPeriod: object({
      start: string().required(),
      end: string().required(),
    }).nullable(),
    updatedAt: string().required(),
    updatePaymentMethodUrl: string(),
  }).required(),
  creditBalance: object({
    availableFormatted: string().required(),
  }).required(),
  isOnPatreon: bool(),
});

export type UserMe = InferType<typeof UserMeSchema>;
