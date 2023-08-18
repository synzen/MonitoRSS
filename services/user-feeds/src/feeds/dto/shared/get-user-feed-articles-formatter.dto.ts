import { IntersectionType } from "@nestjs/mapped-types";
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateIf,
} from "class-validator";
import { FormatOptions } from "../../../article-formatter/types";

class UserFeedFormatOptionsCustomPlaceholder {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  regexSearch: string;

  @IsString()
  @IsNotEmpty()
  replacementString: string;

  @IsString()
  @IsNotEmpty()
  sourcePlaceholder: string;
}

class UserFeedFormatOptions {
  @IsString()
  @ValidateIf((o) => o.dateFormat !== undefined)
  dateFormat?: string;

  @IsString()
  @ValidateIf((o) => o.dateTimezone !== undefined)
  dateTimezone?: string;

  @IsArray()
  @IsObject({ each: true })
  @ValidateIf((o) => o.customPlaceholders !== undefined)
  customPlaceholders?: UserFeedFormatOptionsCustomPlaceholder[];
}

class MediumFormatOptions extends FormatOptions {}

export class GetUserFeedArticlesFormatterDto extends IntersectionType(
  UserFeedFormatOptions,
  MediumFormatOptions
) {}
