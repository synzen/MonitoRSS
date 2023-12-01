import { IntersectionType } from "@nestjs/mapped-types";
import { IsString, ValidateIf } from "class-validator";
import { FormatOptions } from "../../../article-formatter/types";

class UserFeedFormatOptions {
  @IsString()
  @ValidateIf((o) => o.dateFormat !== undefined)
  dateFormat?: string;

  @IsString()
  @ValidateIf((o) => o.dateTimezone !== undefined)
  dateTimezone?: string;

  @IsString()
  @ValidateIf((o) => o.dateLocale !== undefined)
  dateLocale?: string;
}

class MediumFormatOptions extends FormatOptions {}

export class GetUserFeedArticlesFormatterDto extends IntersectionType(
  UserFeedFormatOptions,
  MediumFormatOptions
) {}
