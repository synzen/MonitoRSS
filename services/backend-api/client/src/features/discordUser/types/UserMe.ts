import { InferType, array, bool, number, object, string } from "yup";
import { ProductKey } from "../../../constants";

export const UserMeSchema = object({
  id: string().required(),
  email: string(),
  preferences: object({
    alertOnDisabledFeeds: bool().default(false),
    dateFormat: string().nullable(),
    dateLocale: string().nullable(),
    dateTimezone: string().nullable(),
  }).default({}),
  subscription: object({
    product: object({
      key: string().oneOf(Object.values(ProductKey)).required(),
      name: string().required(),
    }).required(),
    addons: array(
      object({
        key: string().required(),
        quantity: number().required(),
      }).required()
    )
      .optional()
      .nullable(),
    status: string().oneOf(["ACTIVE", "CANCELLED", "PAST_DUE", "PAUSED"]).required(),
    nextBillDate: string().nullable(),
    cancellationDate: string().nullable(),
    billingInterval: string().oneOf(["month", "year"]).nullable(),
    billingPeriod: object({
      start: string().required(),
      end: string().required(),
    }).nullable(),
    updatedAt: string().required(),
  }).required(),
  creditBalance: object({
    availableFormatted: string().required(),
  }).required(),
  isOnPatreon: bool(),
  enableBilling: bool(),
  migratedToPersonalFeeds: bool(),
  featureFlags: object({
    externalProperties: bool(),
  }),
  supporterFeatures: object({
    exrternalProperties: object({
      enabled: bool(),
    }).optional(),
  }).optional(),
  externalAccounts: array(
    object({
      type: string().required(),
    })
  ),
});

export type UserMe = InferType<typeof UserMeSchema>;
