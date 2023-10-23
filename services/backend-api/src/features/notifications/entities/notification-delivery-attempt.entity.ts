import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";
import { NotificationDeliveryAttemptStatus } from "../constants/notification-delivery-attempt-status.constants";
import { NotificationDeliveryAttemptType } from "../constants/notification-delivery-attempt-type.constants";

@Schema({
  collection: "notification_delivery_attempts",
  timestamps: true,
})
export class NotificationDeliveryAttempt {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  email: string;

  @Prop({
    required: true,
    default: NotificationDeliveryAttemptStatus.Pending,
    enum: Object.values(NotificationDeliveryAttemptStatus),
    type: String,
  })
  status: NotificationDeliveryAttemptStatus;

  @Prop({
    required: true,
    enum: Object.values(NotificationDeliveryAttemptType),
    type: String,
  })
  type: NotificationDeliveryAttemptType;

  @Prop({})
  feedId?: string;

  @Prop({})
  connectionId?: string;

  @Prop({
    type: String,
  })
  failReasonInternal?: string;

  createdAt: Date;

  updatedAt: Date;
}

export type NotificationDeliveryAttemptDocument = NotificationDeliveryAttempt &
  Document;
export type NotificationDeliveryAttemptModel =
  Model<NotificationDeliveryAttemptDocument>;
export const NotificationDeliveryAttemptSchema = SchemaFactory.createForClass(
  NotificationDeliveryAttempt
);
export const NotificationDeliveryAttemptFeature: ModelDefinition = {
  name: NotificationDeliveryAttempt.name,
  schema: NotificationDeliveryAttemptSchema,
};
