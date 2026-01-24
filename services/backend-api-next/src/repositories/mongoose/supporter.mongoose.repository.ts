import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { ISupporter, ISupporterRepository } from "../interfaces";
import { SubscriptionStatus, SubscriptionProductKey } from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const PaddleCustomerBenefitsSchema = new Schema(
  {
    maxUserFeeds: { type: Number, required: true },
    allowWebhooks: { type: Boolean, required: true },
    dailyArticleLimit: { type: Number, required: true },
    refreshRateSeconds: { type: Number, required: true },
  },
  { _id: false, versionKey: false, timestamps: false }
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
  { _id: false, versionKey: false, timestamps: false }
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
  { _id: false, versionKey: false, timestamps: false }
);

const PaddleCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    subscription: { type: PaddleCustomerSubscriptionSchema },
    lastCurrencyCodeUsed: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false, versionKey: false, timestamps: true }
);

const SupporterSchema = new Schema(
  {
    _id: { type: String, required: true },
    patron: { type: Boolean },
    stripe: { type: Boolean },
    webhook: { type: Boolean },
    maxGuilds: { type: Number },
    maxFeeds: { type: Number },
    maxUserFeeds: { type: Number },
    allowCustomPlaceholders: { type: Boolean },
    guilds: { type: [String], required: true, default: [] },
    expireAt: { type: Date },
    paddleCustomer: { type: PaddleCustomerSchema },
  },
  { collection: "supporters", _id: false, timestamps: true }
);

type SupporterDoc = InferSchemaType<typeof SupporterSchema>;

export class SupporterMongooseRepository
  extends BaseMongooseRepository<ISupporter, SupporterDoc, string>
  implements ISupporterRepository
{
  private model: Model<SupporterDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<SupporterDoc>("Supporter", SupporterSchema);
  }

  protected toEntity(doc: SupporterDoc & { _id: string }): ISupporter {
    return {
      id: doc._id,
      patron: doc.patron,
      stripe: doc.stripe,
      webhook: doc.webhook,
      maxGuilds: doc.maxGuilds,
      maxFeeds: doc.maxFeeds,
      maxUserFeeds: doc.maxUserFeeds,
      allowCustomPlaceholders: doc.allowCustomPlaceholders,
      guilds: doc.guilds,
      expireAt: doc.expireAt,
      paddleCustomer: doc.paddleCustomer,
    };
  }
}
