import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  ILegacyFeedConversionJob,
  ILegacyFeedConversionJobRepository,
} from "../interfaces";
import { LegacyFeedConversionStatus } from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const LegacyFeedConversionJobSchema = new Schema(
  {
    legacyFeedId: { type: Schema.Types.ObjectId, required: true },
    guildId: { type: String, required: true },
    discordUserId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: LegacyFeedConversionStatus.NotStarted,
      enum: Object.values(LegacyFeedConversionStatus),
    },
    failReasonPublic: { type: String },
    failReasonInternal: { type: String },
  },
  { collection: "legacyfeedconversionjob", timestamps: true }
);

type LegacyFeedConversionJobDoc = InferSchemaType<typeof LegacyFeedConversionJobSchema>;

export class LegacyFeedConversionJobMongooseRepository
  extends BaseMongooseRepository<ILegacyFeedConversionJob, LegacyFeedConversionJobDoc>
  implements ILegacyFeedConversionJobRepository
{
  private model: Model<LegacyFeedConversionJobDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<LegacyFeedConversionJobDoc>(
      "LegacyFeedConversionJob",
      LegacyFeedConversionJobSchema
    );
  }

  protected toEntity(
    doc: LegacyFeedConversionJobDoc & { _id: Types.ObjectId }
  ): ILegacyFeedConversionJob {
    return {
      id: this.objectIdToString(doc._id),
      legacyFeedId: this.objectIdToString(doc.legacyFeedId),
      guildId: doc.guildId,
      discordUserId: doc.discordUserId,
      status: doc.status,
      failReasonPublic: doc.failReasonPublic,
      failReasonInternal: doc.failReasonInternal,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
