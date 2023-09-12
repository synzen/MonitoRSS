import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class CustomPlaceholderStepDto {
  @IsString()
  @IsNotEmpty()
  regexSearch: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.replacementString !== null)
  replacementString?: string | null;
}

export class CustomPlaceholderDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  sourcePlaceholder: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderStepDto)
  steps: CustomPlaceholderStepDto[];
}
