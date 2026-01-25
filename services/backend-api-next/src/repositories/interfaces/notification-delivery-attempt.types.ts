import type {
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
} from "../shared/enums";

export interface INotificationDeliveryAttempt {
  id: string;
  email: string;
  status: NotificationDeliveryAttemptStatus;
  type: NotificationDeliveryAttemptType;
  feedId?: string;
  connectionId?: string;
  failReasonInternal?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationDeliveryAttemptInput {
  email: string;
  status: NotificationDeliveryAttemptStatus;
  type: NotificationDeliveryAttemptType;
  feedId?: string;
  connectionId?: string;
}

export interface INotificationDeliveryAttemptRepository {
  createMany(
    inputs: CreateNotificationDeliveryAttemptInput[]
  ): Promise<INotificationDeliveryAttempt[]>;

  updateManyByIds(
    ids: string[],
    update: {
      status: NotificationDeliveryAttemptStatus;
      failReasonInternal?: string;
    }
  ): Promise<void>;
}
