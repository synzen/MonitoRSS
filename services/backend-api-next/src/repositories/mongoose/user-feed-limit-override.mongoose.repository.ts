import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IUserFeedLimitOverride,
  IUserFeedLimitOverrideRepository,
} from "../interfaces";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const UserFeedLimitOverrideSchema = new Schema(
  {
    _id: { type: String, required: true },
    additionalUserFeeds: { type: Number, required: true, default: 0 },
  },
  { collection: "userfeedlimitoverride", _id: false }
);

type UserFeedLimitOverrideDoc = InferSchemaType<typeof UserFeedLimitOverrideSchema>;

export class UserFeedLimitOverrideMongooseRepository
  extends BaseMongooseRepository<IUserFeedLimitOverride, UserFeedLimitOverrideDoc, string>
  implements IUserFeedLimitOverrideRepository
{
  private model: Model<UserFeedLimitOverrideDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<UserFeedLimitOverrideDoc>(
      "UserFeedLimitOverride",
      UserFeedLimitOverrideSchema
    );
  }

  protected toEntity(doc: UserFeedLimitOverrideDoc & { _id: string }): IUserFeedLimitOverride {
    return {
      id: doc._id,
      additionalUserFeeds: doc.additionalUserFeeds,
    };
  }
}
