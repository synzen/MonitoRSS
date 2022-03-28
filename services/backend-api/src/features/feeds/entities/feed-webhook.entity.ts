import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  _id: false,
})
export class FeedWebhook {
  @Prop({
    required: true,
  })
  id: string;

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop()
  disabled?: boolean;

  @Prop()
  url?: string;
}

export const FeedWebhookSchema = SchemaFactory.createForClass(FeedWebhook);
