import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IPatron, IPatronRepository } from "../interfaces";
import { PatronStatus } from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const PatronSchema = new Schema(
  {
    _id: { type: String },
    statusOverride: { type: String, enum: Object.values(PatronStatus) },
    status: {
      type: String,
      required: true,
      enum: Object.values(PatronStatus),
    },
    lastCharge: { type: Date },
    pledgeLifetime: { type: Number, required: true },
    pledgeOverride: { type: Number },
    pledge: { type: Number, required: true },
    name: { type: String, required: true },
    discord: { type: String },
    email: { type: String, required: true },
  },
  { collection: "patrons", _id: false }
);

type PatronDoc = InferSchemaType<typeof PatronSchema>;

export class PatronMongooseRepository
  extends BaseMongooseRepository<IPatron, PatronDoc, string>
  implements IPatronRepository
{
  private model: Model<PatronDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<PatronDoc>("Patron", PatronSchema);
  }

  protected toEntity(doc: PatronDoc & { _id: string }): IPatron {
    return {
      id: doc._id,
      statusOverride: doc.statusOverride,
      status: doc.status,
      lastCharge: doc.lastCharge,
      pledgeLifetime: doc.pledgeLifetime,
      pledgeOverride: doc.pledgeOverride,
      pledge: doc.pledge,
      name: doc.name,
      discord: doc.discord,
      email: doc.email,
    };
  }

  async create(patron: IPatron): Promise<IPatron> {
    const doc = await this.model.create({
      _id: patron.id,
      statusOverride: patron.statusOverride,
      status: patron.status,
      lastCharge: patron.lastCharge,
      pledgeLifetime: patron.pledgeLifetime,
      pledgeOverride: patron.pledgeOverride,
      pledge: patron.pledge,
      name: patron.name,
      discord: patron.discord,
      email: patron.email,
    });
    return this.toEntity(doc.toObject() as PatronDoc & { _id: string });
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
