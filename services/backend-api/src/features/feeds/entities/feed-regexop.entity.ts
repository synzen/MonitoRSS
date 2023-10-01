import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  _id: false,
})
class FeedRegexOpSearch {
  @Prop({
    required: true,
  })
  regex: string;

  @Prop()
  flags?: string;

  @Prop()
  match?: number;

  @Prop()
  group?: number;
}

@Schema({
  _id: false,
})
export class FeedRegexOp {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    type: FeedRegexOpSearch,
    required: true,
  })
  search: FeedRegexOpSearch;

  @Prop()
  fallbackValue?: string;

  @Prop()
  replacement?: string;

  @Prop()
  replacementDirect?: string;
}

export const FeedRegexOpSchema = SchemaFactory.createForClass(FeedRegexOp);
