import { IsString } from "class-validator";

export class ExternalFeedPropertySelectorDto {}

export class ExternalFeedPropertyDto {
  @IsString()
  sourceField: string;

  @IsString()
  label: string;

  @IsString()
  cssSelector: string;
}
