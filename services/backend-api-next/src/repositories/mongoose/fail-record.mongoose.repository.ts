import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IFailRecord, IFailRecordRepository } from "../interfaces/fail-record.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const FailRecordSchema = new Schema(
  {
    _id: { type: String },
    reason: { type: String, required: false },
    failedAt: { type: Date, required: true, default: Date.now },
    alerted: { type: Boolean, required: true, default: false },
  },
  { collection: "fail_records", _id: false }
);

type FailRecordDoc = InferSchemaType<typeof FailRecordSchema>;

export class FailRecordMongooseRepository
  extends BaseMongooseRepository<IFailRecord, FailRecordDoc, string>
  implements IFailRecordRepository
{
  private model: Model<FailRecordDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<FailRecordDoc>("FailRecord", FailRecordSchema);
  }

  protected toEntity(doc: FailRecordDoc & { _id: string }): IFailRecord {
    return {
      id: doc._id,
      reason: doc.reason,
      failedAt: doc.failedAt,
      alerted: doc.alerted,
    };
  }
}
