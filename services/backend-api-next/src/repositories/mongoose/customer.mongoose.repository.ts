import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { ICustomer, ICustomerRepository } from "../interfaces/customer.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const DiscordConnectionBenefitsSchema = new Schema(
  {
    maxUserFeeds: { type: Number, required: true },
  },
  { _id: false, timestamps: false }
);

const DiscordConnectionSchema = new Schema(
  {
    id: { type: String, required: true },
    benefits: { type: DiscordConnectionBenefitsSchema, required: true },
  },
  { _id: false, timestamps: false }
);

const StripeConnectionSchema = new Schema(
  {
    id: { type: String, required: true },
  },
  { _id: false, timestamps: false }
);

const ConnectionsSchema = new Schema(
  {
    discord: { type: DiscordConnectionSchema, required: true },
    stripe: { type: StripeConnectionSchema, required: true },
  },
  { _id: false, timestamps: false }
);

const CustomerSchema = new Schema(
  {
    connections: { type: ConnectionsSchema, required: true },
    expireAt: { type: Date },
  },
  { collection: "customers" }
);

type CustomerDoc = InferSchemaType<typeof CustomerSchema>;

export class CustomerMongooseRepository
  extends BaseMongooseRepository<ICustomer, CustomerDoc>
  implements ICustomerRepository
{
  private model: Model<CustomerDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<CustomerDoc>("Customer", CustomerSchema);
  }

  protected toEntity(doc: CustomerDoc & { _id: Types.ObjectId }): ICustomer {
    return {
      id: this.objectIdToString(doc._id),
      connections: doc.connections,
      expireAt: doc.expireAt,
    };
  }
}
