import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IUserFeedLimitOverride,
  IUserFeedLimitOverrideRepository,
} from "../interfaces/user-feed-limit-override.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const UserFeedLimitOverrideSchema = new Schema(
  {
    _id: { type: String, required: true },
    additionalUserFeeds: { type: Number, required: true, default: 0 },
  },
  { collection: "userfeedlimitoverride", _id: false },
);

type UserFeedLimitOverrideDoc = InferSchemaType<
  typeof UserFeedLimitOverrideSchema
>;

export class UserFeedLimitOverrideMongooseRepository
  extends BaseMongooseRepository<
    IUserFeedLimitOverride,
    UserFeedLimitOverrideDoc,
    string
  >
  implements IUserFeedLimitOverrideRepository
{
  private model: Model<UserFeedLimitOverrideDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<UserFeedLimitOverrideDoc>(
      "UserFeedLimitOverride",
      UserFeedLimitOverrideSchema,
    );
  }

  protected toEntity(
    doc: UserFeedLimitOverrideDoc & { _id: string },
  ): IUserFeedLimitOverride {
    return {
      id: doc._id,
      additionalUserFeeds: doc.additionalUserFeeds,
    };
  }

  async findById(id: string): Promise<IUserFeedLimitOverride | null> {
    const doc = await this.model.findById(id).lean();
    return doc
      ? this.toEntity(doc as UserFeedLimitOverrideDoc & { _id: string })
      : null;
  }

  async findByIdsNotIn(
    excludeIds: string[],
  ): Promise<IUserFeedLimitOverride[]> {
    const docs = await this.model.find({ _id: { $nin: excludeIds } }).lean();
    return docs.map((doc) =>
      this.toEntity(doc as UserFeedLimitOverrideDoc & { _id: string }),
    );
  }

  async create(input: IUserFeedLimitOverride): Promise<IUserFeedLimitOverride> {
    const doc = await this.model.create({
      _id: input.id,
      additionalUserFeeds: input.additionalUserFeeds,
    });
    return this.toEntity(
      doc.toObject() as UserFeedLimitOverrideDoc & { _id: string },
    );
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
