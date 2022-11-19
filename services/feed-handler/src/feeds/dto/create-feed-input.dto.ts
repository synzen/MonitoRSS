import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";

class FeedDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateFeedInputDto {
  @IsObject()
  @Type(() => FeedDto)
  @ValidateNested()
  feed: FeedDto;

  @IsNumber()
  @IsNotEmpty()
  articleDailyLimit: number;
}
