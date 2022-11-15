import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from "class-validator";

class GetUserFeedsOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}

export class GetUserFeedsOutputDto {
  @IsInt()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetUserFeedsOutputResultDto)
  results: GetUserFeedsOutputResultDto[];
}
