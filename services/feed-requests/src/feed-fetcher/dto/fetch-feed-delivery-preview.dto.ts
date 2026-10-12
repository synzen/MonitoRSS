import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { HttpValidator } from './fetch-feed.dto';

export class FetchFeedDeliveryPreviewDto {
  @Validate(HttpValidator)
  url!: string;

  @IsString()
  @IsOptional()
  lookupKey?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  stalenessThresholdSeconds?: number;

  @IsString()
  @IsOptional()
  hashToCompare?: string;
}
