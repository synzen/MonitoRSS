import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  ValidateNested,
} from "class-validator";

export class UpdateUserFeedOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}

export class UpdateUserFeedOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateUserFeedOutputDto)
  result: UpdateUserFeedOutputResultDto;
}
