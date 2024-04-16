import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class ArticleInjectionSelector {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  label: string;

  @Prop({
    required: true,
  })
  cssSelector: string;
}

export const ArticleInjectionFieldSchema = SchemaFactory.createForClass(
  ArticleInjectionSelector
);

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class ArticleInjection {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  sourceField: string;

  @Prop({
    required: true,
    type: [ArticleInjectionFieldSchema],
  })
  selectors: ArticleInjectionSelector[];
}

export const ArticleInjectionSchema =
  SchemaFactory.createForClass(ArticleInjection);
