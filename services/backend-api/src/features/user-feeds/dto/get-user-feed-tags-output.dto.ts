import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class GetUserFeedTagsOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsArray()
  @IsString({ each: true })
  feedIds: string[];
}

export class GetUserFeedTagsOutputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetUserFeedTagsOutputResultDto)
  results: GetUserFeedTagsOutputResultDto[];
}
