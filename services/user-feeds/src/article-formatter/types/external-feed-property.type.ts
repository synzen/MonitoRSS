import { Type } from "class-transformer";
import { IsArray, IsObject, IsString, ValidateNested } from "class-validator";

export class ExternalFeedPropertySelectorDto {
  @IsString()
  label: string;

  @IsString()
  cssSelector: string;
}

export class ExternalFeedPropertyDto {
  @IsString()
  sourceField: string;

  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ExternalFeedPropertySelectorDto)
  selectors: ExternalFeedPropertySelectorDto[];
}
