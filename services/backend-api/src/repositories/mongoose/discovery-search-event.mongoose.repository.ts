import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IDiscoverySearchEvent,
  IDiscoverySearchEventRepository,
} from "../interfaces/discovery-search-event.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const DiscoverySearchEventSchema = new Schema(
  {
    searchTerm: { type: String, required: true },
    resultCount: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: "discovery_search_events" },
);

DiscoverySearchEventSchema.index({ createdAt: 1 });
DiscoverySearchEventSchema.index({ searchTerm: 1 });

type DiscoverySearchEventDoc = InferSchemaType<
  typeof DiscoverySearchEventSchema
>;

export class DiscoverySearchEventMongooseRepository
  extends BaseMongooseRepository<IDiscoverySearchEvent, DiscoverySearchEventDoc>
  implements IDiscoverySearchEventRepository
{
  private model: Model<DiscoverySearchEventDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<DiscoverySearchEventDoc>(
      "DiscoverySearchEvent",
      DiscoverySearchEventSchema,
    );
  }

  protected toEntity(
    doc: DiscoverySearchEventDoc & { _id: Types.ObjectId },
  ): IDiscoverySearchEvent {
    return {
      id: this.objectIdToString(doc._id),
      searchTerm: doc.searchTerm,
      resultCount: doc.resultCount,
      createdAt: doc.createdAt,
    };
  }

  async create(event: Omit<IDiscoverySearchEvent, "id">): Promise<void> {
    await this.model.create(event);
  }
}
