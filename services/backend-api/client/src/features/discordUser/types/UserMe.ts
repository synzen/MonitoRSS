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
    feedListSort: object({
      key: string().required(),
      direction: string().oneOf(["asc", "desc"]).required(),
    })
      .nullable()
      .optional(),
    feedListColumnVisibility: object({
      computedStatus: bool().optional(),
      title: bool().optional(),
      url: bool().optional(),
      createdAt: bool().optional(),
      ownedByUser: bool().optional(),
      refreshRateSeconds: bool().optional(),
    }).optional(),
    feedListColumnOrder: object({
      columns: array(string().required()).required(),
    }).optional(),
    feedListStatusFilters: object({
      statuses: array(string().required()).required(),
    }).optional(),
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
    pastDueGracePeriodEndDate: string().nullable(),
  }).required(),
  creditBalance: object({
    availableFormatted: string().required(),
  }).required(),
  isOnPatreon: bool(),
  enableBilling: bool(),
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
      status: string().oneOf(["REVOKED", "ACTIVE"]).required(),
    })
  ),
});

export type UserMe = InferType<typeof UserMeSchema>;
