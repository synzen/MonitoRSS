import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CustomPlaceholderStepType } from "../constants/custom-placeholder-step-type.constants";

class CustomPlaceholderBaseStep {
  @IsString()
  @IsOptional()
  id?: string;

  @IsIn(Object.values(CustomPlaceholderStepType))
  @IsOptional()
  type: CustomPlaceholderStepType = CustomPlaceholderStepType.Regex;
}

export class CustomPlaceholderRegexStep {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([CustomPlaceholderStepType.Regex])
  type: CustomPlaceholderStepType.Regex;

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
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([CustomPlaceholderStepType.UrlEncode])
  type: CustomPlaceholderStepType.UrlEncode;
}

export class CustomPlaceholderDateFormatStep extends CustomPlaceholderBaseStep {
  @IsString()
  @IsOptional()
  id?: string;

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

export class CustomPlaceholderDto {
  @IsString()
  @IsOptional()
  id?: string;

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
