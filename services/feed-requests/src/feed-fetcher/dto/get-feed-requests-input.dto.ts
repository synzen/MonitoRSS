import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class GetFeedRequestsLookupDetailsDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

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

  @IsObject()
  @IsOptional()
  @Type(() => GetFeedRequestsLookupDetailsDto)
  @ValidateNested()
  lookupDetails?: GetFeedRequestsLookupDetailsDto;
}
