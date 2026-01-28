import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  INotificationDeliveryAttempt,
  INotificationDeliveryAttemptRepository,
  CreateNotificationDeliveryAttemptInput,
} from "../interfaces/notification-delivery-attempt.types";
import {
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
} from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const NotificationDeliveryAttemptSchema = new Schema(
  {
    email: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: NotificationDeliveryAttemptStatus.Pending,
      enum: Object.values(NotificationDeliveryAttemptStatus),
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(NotificationDeliveryAttemptType),
    },
    feedId: { type: String },
    connectionId: { type: String },
    failReasonInternal: { type: String },
  },
  { collection: "notification_delivery_attempts", timestamps: true },
);

type NotificationDeliveryAttemptDoc = InferSchemaType<
  typeof NotificationDeliveryAttemptSchema
>;

export class NotificationDeliveryAttemptMongooseRepository
  extends BaseMongooseRepository<
    INotificationDeliveryAttempt,
    NotificationDeliveryAttemptDoc
  >
  implements INotificationDeliveryAttemptRepository
{
  private model: Model<NotificationDeliveryAttemptDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<NotificationDeliveryAttemptDoc>(
      "NotificationDeliveryAttempt",
      NotificationDeliveryAttemptSchema,
    );
  }

  protected toEntity(
    doc: NotificationDeliveryAttemptDoc & { _id: Types.ObjectId },
  ): INotificationDeliveryAttempt {
    return {
      id: this.objectIdToString(doc._id),
      email: doc.email,
      status: doc.status,
      type: doc.type,
      feedId: doc.feedId,
      connectionId: doc.connectionId,
      failReasonInternal: doc.failReasonInternal,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async createMany(
    inputs: CreateNotificationDeliveryAttemptInput[],
  ): Promise<INotificationDeliveryAttempt[]> {
    const docs = await this.model.create(inputs);
    return docs.map((doc) => this.toEntity(doc.toObject()));
  }

  async updateManyByIds(
    ids: string[],
    update: {
      status: NotificationDeliveryAttemptStatus;
      failReasonInternal?: string;
    },
  ): Promise<void> {
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    await this.model.updateMany({ _id: { $in: objectIds } }, { $set: update });
  }
}
