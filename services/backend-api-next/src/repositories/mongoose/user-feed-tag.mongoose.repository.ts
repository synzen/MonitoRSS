import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IUserFeedTag, IUserFeedTagRepository } from "../interfaces";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const UserFeedTagSchema = new Schema(
  {
    label: { type: String, required: true },
    color: { type: String },
    feedIds: {
      type: [Schema.Types.ObjectId],
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { collection: "user_feed_tags", timestamps: true, autoIndex: true }
);

type UserFeedTagDoc = InferSchemaType<typeof UserFeedTagSchema>;

export class UserFeedTagMongooseRepository
  extends BaseMongooseRepository<IUserFeedTag, UserFeedTagDoc>
  implements IUserFeedTagRepository
{
  private model: Model<UserFeedTagDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<UserFeedTagDoc>("UserFeedTag", UserFeedTagSchema);
  }

  protected toEntity(doc: UserFeedTagDoc & { _id: Types.ObjectId }): IUserFeedTag {
    return {
      id: this.objectIdToString(doc._id),
      label: doc.label,
      color: doc.color,
      feedIds: doc.feedIds.map((id) => id.toString()),
      userId: doc.userId.toString(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
