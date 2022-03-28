import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

class CreateFeedInputFeedsDto {
  @IsString()
  title: string;

  @IsString()
  @IsUrl()
  url: string;
}

export class CreateFeedInputDto {
  @IsString()
  channelId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedInputFeedsDto)
  // Temporarily only restrict to 1, will support more in the future
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  feeds: CreateFeedInputFeedsDto[];
}
