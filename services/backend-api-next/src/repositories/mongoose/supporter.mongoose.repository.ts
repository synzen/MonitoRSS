import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  ISupporter,
  ISupporterRepository,
  SupportPatronAggregateResult,
  SupporterGuildAggregateResult,
} from "../interfaces/supporter.types";
import { SubscriptionStatus, SubscriptionProductKey } from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

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

const PaddleCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    subscription: { type: PaddleCustomerSubscriptionSchema },
    lastCurrencyCodeUsed: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false, versionKey: false, timestamps: true },
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
    slowRate: { type: Boolean },
  },
  { collection: "supporters", _id: false },
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
      slowRate: doc.slowRate,
    };
  }

  async findById(id: string): Promise<ISupporter | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toEntity(doc as SupporterDoc & { _id: string }) : null;
  }

  async findByPaddleEmail(email: string): Promise<ISupporter | null> {
    const doc = await this.model
      .findOne({ "paddleCustomer.email": email })
      .lean();
    return doc ? this.toEntity(doc as SupporterDoc & { _id: string }) : null;
  }

  async create(supporter: ISupporter): Promise<ISupporter> {
    const doc = await this.model.create({
      _id: supporter.id,
      patron: supporter.patron,
      stripe: supporter.stripe,
      webhook: supporter.webhook,
      maxGuilds: supporter.maxGuilds,
      maxFeeds: supporter.maxFeeds,
      maxUserFeeds: supporter.maxUserFeeds,
      allowCustomPlaceholders: supporter.allowCustomPlaceholders,
      guilds: supporter.guilds,
      expireAt: supporter.expireAt,
      paddleCustomer: supporter.paddleCustomer,
    });
    return this.toEntity(doc.toObject() as SupporterDoc & { _id: string });
  }

  async updateGuilds(
    userId: string,
    guildIds: string[],
  ): Promise<ISupporter | null> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: userId },
        { $set: { guilds: guildIds } },
        { new: true },
      )
      .lean();
    return doc ? this.toEntity(doc as SupporterDoc & { _id: string }) : null;
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }

  async aggregateWithPatronsAndOverrides(
    discordId: string,
  ): Promise<SupportPatronAggregateResult[]> {
    const results = await this.model.aggregate([
      { $match: { _id: discordId } },
      {
        $lookup: {
          from: "patrons",
          localField: "_id",
          foreignField: "discord",
          as: "patrons",
        },
      },
      {
        $lookup: {
          from: "userfeedlimitoverride",
          localField: "_id",
          foreignField: "_id",
          as: "userFeedLimitOverrides",
        },
      },
    ]);

    return results.map((r) => ({
      id: r._id,
      patron: r.patron,
      maxFeeds: r.maxFeeds,
      maxUserFeeds: r.maxUserFeeds,
      maxGuilds: r.maxGuilds,
      slowRate: r.slowRate,
      allowCustomPlaceholders: r.allowCustomPlaceholders,
      guilds: r.guilds,
      expireAt: r.expireAt,
      paddleCustomer: r.paddleCustomer,
      patrons: (r.patrons || []).map((p: Record<string, unknown>) => ({
        id: p._id as string,
        status: p.status as string,
        pledge: p.pledge as number,
        pledgeLifetime: p.pledgeLifetime as number,
        pledgeOverride: p.pledgeOverride as number | undefined,
        lastCharge: p.lastCharge as Date | undefined,
      })),
      userFeedLimitOverrides: (r.userFeedLimitOverrides || []).map(
        (u: Record<string, unknown>) => ({
          id: u._id as string,
          additionalUserFeeds: u.additionalUserFeeds as number,
        }),
      ),
    }));
  }

  async aggregateSupportersForGuilds(
    guildIds: string[],
  ): Promise<SupporterGuildAggregateResult[]> {
    const results = await this.model.aggregate([
      { $match: { guilds: { $in: guildIds } } },
      {
        $lookup: {
          from: "patrons",
          localField: "_id",
          foreignField: "discord",
          as: "patrons",
        },
      },
      {
        $lookup: {
          from: "userfeedlimitoverride",
          localField: "_id",
          foreignField: "_id",
          as: "userFeedLimitOverrides",
        },
      },
      { $unwind: "$guilds" },
      { $match: { guilds: { $in: guildIds } } },
      { $addFields: { guildId: "$guilds" } },
    ]);

    return results.map((r) => ({
      id: r._id,
      patron: r.patron,
      maxFeeds: r.maxFeeds,
      maxUserFeeds: r.maxUserFeeds,
      maxGuilds: r.maxGuilds,
      slowRate: r.slowRate,
      allowCustomPlaceholders: r.allowCustomPlaceholders,
      guildId: r.guildId,
      expireAt: r.expireAt,
      paddleCustomer: r.paddleCustomer,
      patrons: (r.patrons || []).map((p: Record<string, unknown>) => ({
        id: p._id as string,
        status: p.status as string,
        pledge: p.pledge as number,
        pledgeLifetime: p.pledgeLifetime as number,
        pledgeOverride: p.pledgeOverride as number | undefined,
        lastCharge: p.lastCharge as Date | undefined,
      })),
      userFeedLimitOverrides: (r.userFeedLimitOverrides || []).map(
        (u: Record<string, unknown>) => ({
          id: u._id as string,
          additionalUserFeeds: u.additionalUserFeeds as number,
        }),
      ),
    }));
  }

  async aggregateAllSupportersWithPatrons(): Promise<
    SupportPatronAggregateResult[]
  > {
    const results = await this.model.aggregate([
      {
        $lookup: {
          from: "patrons",
          localField: "_id",
          foreignField: "discord",
          as: "patrons",
        },
      },
      {
        $lookup: {
          from: "userfeedlimitoverride",
          localField: "_id",
          foreignField: "_id",
          as: "userFeedLimitOverrides",
        },
      },
    ]);

    return results.map((r) => ({
      id: r._id,
      patron: r.patron,
      maxFeeds: r.maxFeeds,
      maxUserFeeds: r.maxUserFeeds,
      maxGuilds: r.maxGuilds,
      slowRate: r.slowRate,
      allowCustomPlaceholders: r.allowCustomPlaceholders,
      guilds: r.guilds,
      expireAt: r.expireAt,
      paddleCustomer: r.paddleCustomer,
      patrons: (r.patrons || []).map((p: Record<string, unknown>) => ({
        id: p._id as string,
        status: p.status as string,
        pledge: p.pledge as number,
        pledgeLifetime: p.pledgeLifetime as number,
        pledgeOverride: p.pledgeOverride as number | undefined,
        lastCharge: p.lastCharge as Date | undefined,
      })),
      userFeedLimitOverrides: (r.userFeedLimitOverrides || []).map(
        (u: Record<string, unknown>) => ({
          id: u._id as string,
          additionalUserFeeds: u.additionalUserFeeds as number,
        }),
      ),
    }));
  }

  async aggregateAllSupportersWithGuilds(): Promise<
    SupporterGuildAggregateResult[]
  > {
    const results = await this.model.aggregate([
      {
        $lookup: {
          from: "patrons",
          localField: "_id",
          foreignField: "discord",
          as: "patrons",
        },
      },
      {
        $lookup: {
          from: "userfeedlimitoverride",
          localField: "_id",
          foreignField: "_id",
          as: "userFeedLimitOverrides",
        },
      },
      { $unwind: "$guilds" },
      { $addFields: { guildId: "$guilds" } },
    ]);

    return results.map((r) => ({
      id: r._id,
      patron: r.patron,
      maxFeeds: r.maxFeeds,
      maxUserFeeds: r.maxUserFeeds,
      maxGuilds: r.maxGuilds,
      slowRate: r.slowRate,
      allowCustomPlaceholders: r.allowCustomPlaceholders,
      guildId: r.guildId,
      expireAt: r.expireAt,
      paddleCustomer: r.paddleCustomer,
      patrons: (r.patrons || []).map((p: Record<string, unknown>) => ({
        id: p._id as string,
        status: p.status as string,
        pledge: p.pledge as number,
        pledgeLifetime: p.pledgeLifetime as number,
        pledgeOverride: p.pledgeOverride as number | undefined,
        lastCharge: p.lastCharge as Date | undefined,
      })),
      userFeedLimitOverrides: (r.userFeedLimitOverrides || []).map(
        (u: Record<string, unknown>) => ({
          id: u._id as string,
          additionalUserFeeds: u.additionalUserFeeds as number,
        }),
      ),
    }));
  }
}
