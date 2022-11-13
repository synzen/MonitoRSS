import { Prop, Schema, SchemaFactory, ModelDefinition } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserFeedDisabledCode {
  BadFormat = 'bad-format',
  FailedRequests = 'failed-requests',
  Manual = 'manual',
}

export enum UserFeedHealthStatus {
  Ok = 'Ok',
  Failed = 'Failed',
  Failing = 'Failing',
}

@Schema()
export class UserFeed {
  @Prop({
    required: true,
  })
  url!: string;

  @Prop({
    required: false,
    enum: Object.values(UserFeedDisabledCode),
  })
  disabledCode?: UserFeedDisabledCode;

  @Prop({
    required: true,
    enum: Object.values(UserFeedHealthStatus),
  })
  healthStatus!: UserFeedHealthStatus;
}

export type UserFeedDocument = UserFeed & Document;
export const UserFeedSchema = SchemaFactory.createForClass(UserFeed);
export const UserFeedFeature: ModelDefinition = {
  name: UserFeed.name,
  schema: UserFeedSchema,
};
