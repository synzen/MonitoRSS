import { Schema } from "mongoose";
import { SubscriptionStatus, SubscriptionProductKey } from "../shared/enums";

// The Paddle customer + subscription record shape. Stored on the supporter
// document (personal subscriptions) and on the workspace document (workspace
// subscriptions) so both billing surfaces share one shape and the webhook
// handler can build a single record for either destination.
const PaddleCustomerBenefitsSchema = new Schema(
  {
    maxUserFeeds: { type: Number, required: true },
    allowWebhooks: { type: Boolean, required: true },
    dailyArticleLimit: { type: Number, required: true },
    refreshRateSeconds: { type: Number, required: true },
  },
  { _id: false, versionKey: false, timestamps: false },
);

const PaddleCustomerSubscriptionAddonSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      enum: [SubscriptionProductKey.Tier3AdditionalFeed],
    },
    quantity: { type: Number, required: true },
  },
  { _id: false, versionKey: false, timestamps: false },
);

const PaddleCustomerSubscriptionSchema = new Schema(
  {
    productKey: {
      type: String,
      required: true,
      enum: Object.values(SubscriptionProductKey),
    },
    id: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(SubscriptionStatus),
    },
    currencyCode: { type: String, required: true },
    cancellationDate: { type: Date },
    nextBillDate: { type: Date },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    billingInterval: { type: String, required: true, enum: ["month", "year"] },
    benefits: { type: PaddleCustomerBenefitsSchema, required: true },
    addons: { type: [PaddleCustomerSubscriptionAddonSchema], default: [] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false, timestamps: false },
);

export const PaddleCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    subscription: { type: PaddleCustomerSubscriptionSchema },
    lastCurrencyCodeUsed: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false, versionKey: false, timestamps: true },
);
