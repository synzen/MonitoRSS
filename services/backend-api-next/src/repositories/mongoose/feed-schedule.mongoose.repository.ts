import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IFeedSchedule, IFeedScheduleRepository } from "../interfaces/feed-schedule.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const FeedScheduleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    keywords: { type: [String], default: [] },
    feeds: { type: [String], default: [] },
    refreshRateMinutes: { type: Number, required: true },
  },
  { collection: "schedules" }
);

type FeedScheduleDoc = InferSchemaType<typeof FeedScheduleSchema>;

export class FeedScheduleMongooseRepository
  extends BaseMongooseRepository<IFeedSchedule, FeedScheduleDoc>
  implements IFeedScheduleRepository
{
  private model: Model<FeedScheduleDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<FeedScheduleDoc>(
      "FeedSchedule",
      FeedScheduleSchema
    );
  }

  protected toEntity(doc: FeedScheduleDoc & { _id: Types.ObjectId }): IFeedSchedule {
    return {
      id: this.objectIdToString(doc._id),
      name: doc.name,
      keywords: doc.keywords,
      feeds: doc.feeds,
      refreshRateMinutes: doc.refreshRateMinutes,
    };
  }
}
