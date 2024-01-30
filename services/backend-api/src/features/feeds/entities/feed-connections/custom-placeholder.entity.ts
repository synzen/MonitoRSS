import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { CustomPlaceholderStepType } from "../../../../common/constants/custom-placeholder-step-type.constants";

@Schema({
  discriminatorKey: "type",
  timestamps: false,
  versionKey: false,
  _id: false,
})
class CustomPlaceholderBaseStep {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(CustomPlaceholderStepType),
  })
  type: CustomPlaceholderStepType;
}

const CustomPlaceholderBaseStepSchema = SchemaFactory.createForClass(
  CustomPlaceholderBaseStep
);

@Schema({
  timestamps: false,
  versionKey: false,
})
export class CustomPlaceholderRegexStep {
  type: CustomPlaceholderStepType.Regex;

  @Prop({
    required: true,
  })
  regexSearch: string;

  @Prop({
    required: false,
    type: String,
  })
  regexSearchFlags?: string | null;

  @Prop({
    required: false,
    type: String,
  })
  replacementString?: string | null;
}

export const CustomPlaceholderRegexStepSchema = SchemaFactory.createForClass(
  CustomPlaceholderRegexStep
);

@Schema({
  timestamps: false,
  versionKey: false,
})
export class CustomPlaceholderUrlEncodeStep {
  type: CustomPlaceholderStepType.UrlEncode;
}

export const CustomPlaceholderUrlEncodeStepSchema =
  SchemaFactory.createForClass(CustomPlaceholderUrlEncodeStep);

@Schema({
  timestamps: false,
  versionKey: false,
})
export class CustomPlaceholderDateFormatStep {
  type: CustomPlaceholderStepType.DateFormat;

  @Prop({
    required: true,
  })
  format: string;

  @Prop({
    required: false,
    type: String,
  })
  timezone?: string | null;

  @Prop({
    required: false,
    type: String,
  })
  locale?: string | null;
}

export const CustomPlaceholderDateFormatStepSchema =
  SchemaFactory.createForClass(CustomPlaceholderDateFormatStep);

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class CustomPlaceholder {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  referenceName: string;

  @Prop({
    required: true,
  })
  sourcePlaceholder: string;

  @Prop({
    required: true,
    type: [CustomPlaceholderBaseStepSchema],
  })
  steps: Array<
    | CustomPlaceholderRegexStep
    | CustomPlaceholderUrlEncodeStep
    | CustomPlaceholderDateFormatStep
  >;
}

export const CustomPlaceholderSchema =
  SchemaFactory.createForClass(CustomPlaceholder);

const stepsSchema = CustomPlaceholderSchema.path(
  "steps"
) as MongooseSchema.Types.DocumentArray;

stepsSchema.discriminator(
  CustomPlaceholderStepType.Regex,
  CustomPlaceholderRegexStepSchema
);

stepsSchema.discriminator(
  CustomPlaceholderStepType.UrlEncode,
  CustomPlaceholderUrlEncodeStepSchema
);

stepsSchema.discriminator(
  CustomPlaceholderStepType.DateFormat,
  CustomPlaceholderDateFormatStepSchema
);
