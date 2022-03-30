import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types, Schema as MongooseSchema } from 'mongoose';

export enum FeedSubscriberType {
  USER = 'user',
  ROLE = 'role',
}

@Schema({
  collection: 'subscribers',
  timestamps: true,
})
export class FeedSubscriber {
  _id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
  })
  feed: Types.ObjectId;

  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    required: true,
    enum: Object.values(FeedSubscriberType),
  })
  type: FeedSubscriberType;

  @Prop({
    type: Map,
    of: [String],
  })
  filters?: Record<string, string[]>;

  @Prop({
    type: Map,
    of: String,
  })
  rfilters?: Record<string, string>;

  // Added by timestamps: true option
  createdAt?: Date;
  updatedAt?: Date;
}

export type FeedSubscriberDocument = FeedSubscriber & Document;
export type FeedSubscriberModel = Model<FeedSubscriberDocument>;
export const FeedSubscriberSchema =
  SchemaFactory.createForClass(FeedSubscriber);
export const FeedSubscriberFeature: ModelDefinition = {
  name: FeedSubscriber.name,
  schema: FeedSubscriberSchema,
};
