export interface IFeedSubscriber {
  id: string;
  feedId: string;
  subscriberId: string;
  type: "user" | "role";
  filters?: Record<string, string[]>;
  rfilters?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFeedSubscriberRepository {}
