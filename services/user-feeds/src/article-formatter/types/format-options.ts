import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CustomPlaceholderStepType } from "../../shared";

class SplitOptions {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  splitChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  appendChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  prependChar?: string | null;

  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isEnabled?: boolean;
}

class CustomPlaceholderBaseStep {
  @IsIn([Object.values(CustomPlaceholderStepType)])
  @IsOptional()
  type: CustomPlaceholderStepType = CustomPlaceholderStepType.Regex;
}

export class CustomPlaceholderRegexStep extends CustomPlaceholderBaseStep {
  @IsString()
  @IsNotEmpty()
  @IsIn([CustomPlaceholderStepType.Regex])
  type: CustomPlaceholderStepType.Regex = CustomPlaceholderStepType.Regex;

  @IsString()
  @IsNotEmpty()
  regexSearch: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.regexSearchFlags !== null)
  regexSearchFlags?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.replacementString !== null)
  replacementString?: string | null;
}

export class CustomPlaceholderUrlEncodeStep extends CustomPlaceholderBaseStep {
  @IsString()
  @IsNotEmpty()
  @IsIn([CustomPlaceholderStepType.UrlEncode])
  type: CustomPlaceholderStepType.UrlEncode;
}

export class CustomPlaceholderDateFormatStep extends CustomPlaceholderBaseStep {
  @IsString()
  @IsNotEmpty()
  @IsIn([CustomPlaceholderStepType.DateFormat])
  type: CustomPlaceholderStepType.DateFormat;

  @IsString()
  @IsNotEmpty()
  format: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.timezone !== null)
  timezone?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.locale !== null)
  locale?: string | null;
}

type CustomPlaceholderStep =
  | CustomPlaceholderRegexStep
  | CustomPlaceholderUrlEncodeStep
  | CustomPlaceholderDateFormatStep;

export class CustomPlaceholder {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  referenceName: string;

  @IsString()
  @IsNotEmpty()
  sourcePlaceholder: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderBaseStep, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: "type",
      subTypes: [
        {
          value: CustomPlaceholderRegexStep,
          name: CustomPlaceholderStepType.Regex,
        },
        {
          value: CustomPlaceholderUrlEncodeStep,
          name: CustomPlaceholderStepType.UrlEncode,
        },
        {
          value: CustomPlaceholderDateFormatStep,
          name: CustomPlaceholderStepType.DateFormat,
        },
      ],
    },
  })
  steps: CustomPlaceholderStep[];
}

export class FormatOptions {
  @IsBoolean()
  @Type(() => Boolean)
  stripImages: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  disableImageLinkPreviews: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  formatTables: boolean;

  @IsObject()
  @IsOptional()
  @Type(() => SplitOptions)
  @ValidateNested()
  split?: SplitOptions;

  @IsObject({ each: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholder)
  customPlaceholders: CustomPlaceholder[] | undefined | null;
}
