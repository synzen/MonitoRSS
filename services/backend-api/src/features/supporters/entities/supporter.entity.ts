import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";
import { SubscriptionStatus } from "../../../common/constants/subscription-status.constants";
@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
class PaddleCustomerBenefits {
  @Prop({
    required: true,
  })
  maxUserFeeds: number;

  @Prop({
    required: true,
  })
  allowWebhooks: boolean;

  @Prop({
    required: true,
  })
  dailyArticleLimit: number;

  @Prop({
    required: true,
  })
  refreshRateSeconds: number;
}

const PaddleCustomerBenefitsSchema = SchemaFactory.createForClass(
  PaddleCustomerBenefits
);

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
class PaddleCustomer {
  @Prop({
    required: true,
  })
  customerId: string;

  @Prop({
    required: true,
  })
  productKey: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(SubscriptionStatus),
  })
  status: SubscriptionStatus;

  @Prop({
    required: true,
  })
  email: string;

  @Prop({
    required: true,
    type: PaddleCustomerBenefitsSchema,
  })
  benefits: PaddleCustomerBenefits;

  @Prop({
    required: true,
  })
  createdAt: string;

  @Prop({
    required: true,
  })
  updatedAt: Date;
}

const PaddleCustomerSchema = SchemaFactory.createForClass(PaddleCustomer);

@Schema({
  collection: "supporters",
})
export class Supporter {
  @Prop({
    required: true,
    type: String,
  })
  _id: string;

  @Prop()
  patron?: boolean;

  @Prop()
  stripe?: boolean;

  @Prop()
  webhook?: boolean;

  @Prop()
  maxGuilds?: number;

  @Prop()
  maxFeeds?: number;

  @Prop()
  maxUserFeeds?: number;

  @Prop()
  allowCustomPlaceholders?: boolean;

  @Prop({
    type: [String],
    required: true,
  })
  guilds: string[];

  @Prop()
  expireAt?: Date;

  @Prop({
    required: true,
    type: PaddleCustomerSchema,
  })
  paddleCustomer?: PaddleCustomer;
}

export type SupporterDocument = Supporter & Document;
export type SupporterModel = Model<SupporterDocument>;
export const SupporterSchema = SchemaFactory.createForClass(Supporter);
export const SupporterFeature: ModelDefinition = {
  name: Supporter.name,
  schema: SupporterSchema,
};
