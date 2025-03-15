import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetFeedRequestsInputDto {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  skip!: number;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  lookupKey?: string;

  @IsString()
  @IsOptional()
  afterDate?: string;

  @IsString()
  @IsOptional()
  beforeDate?: string;
}
