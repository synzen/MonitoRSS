import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";

export class ExternalPropertyFieldDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  cssSelector: string;
}

export class ExternalPropertyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  sourceField: string;

  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ExternalPropertyFieldDto)
  selectors: ExternalPropertyFieldDto[];
}
