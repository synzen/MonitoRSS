import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model, Types } from "mongoose";

@Schema({
  _id: false,
  timestamps: false,
})
class DiscordConnectionBenefits {
  @Prop({
    required: true,
  })
  maxUserFeeds: number;
}

const DiscordConnectionBenefitsSchema = SchemaFactory.createForClass(
  DiscordConnectionBenefits
);

@Schema({
  _id: false,
  timestamps: false,
})
class DiscordConnection {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    required: true,
    type: DiscordConnectionBenefitsSchema,
  })
  benefits: DiscordConnectionBenefits;
}

const DiscordConnectionSchema = SchemaFactory.createForClass(DiscordConnection);

@Schema({
  _id: false,
  timestamps: false,
})
class StripeConnection {
  @Prop({
    required: true,
  })
  id: string;
}

const StripeConnectionSchema = SchemaFactory.createForClass(StripeConnection);

@Schema({
  _id: false,
  timestamps: false,
})
class Connections {
  @Prop({
    required: true,
    type: DiscordConnectionSchema,
  })
  discord: DiscordConnection;

  @Prop({
    required: true,
    type: StripeConnectionSchema,
  })
  stripe: StripeConnection;
}

const ConnectionsSchema = SchemaFactory.createForClass(Connections);

@Schema({
  collection: "customers",
})
export class Customer {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    type: ConnectionsSchema,
  })
  connections: Connections;

  @Prop({
    required: false,
  })
  expireAt?: Date;
}

export type CustomerDocument = Customer & Document;
export type CustomerModel = Model<CustomerDocument>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
export const CustomerFeature: ModelDefinition = {
  name: Customer.name,
  schema: CustomerSchema,
};
