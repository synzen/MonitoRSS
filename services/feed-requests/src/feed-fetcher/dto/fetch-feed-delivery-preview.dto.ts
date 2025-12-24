import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Validate } from 'class-validator';
import { HttpValidator } from './fetch-feed.dto';

export class FetchFeedDeliveryPreviewDto {
  @Validate(HttpValidator)
  url!: string;

  @IsString()
  @IsOptional()
  lookupKey?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  stalenessThresholdSeconds?: number;

  @IsString()
  @IsOptional()
  hashToCompare?: string;
}
