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

export interface INotificationDeliveryAttemptRepository {}
