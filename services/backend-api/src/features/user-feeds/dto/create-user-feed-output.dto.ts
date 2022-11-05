import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  ValidateNested,
} from "class-validator";

class CreateUserFeedOutputDataDto {
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

export class CreateUserFeedOutputDto {
  @IsObject()
  @Type(() => CreateUserFeedOutputDataDto)
  @ValidateNested()
  result: CreateUserFeedOutputDataDto;
}
