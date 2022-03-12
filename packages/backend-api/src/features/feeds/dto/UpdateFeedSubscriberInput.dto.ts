import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class UpdateFeedSubscriberInputFiltersDto {
  @IsString()
  category: string;

  @IsString()
  value: string;
}

export class UpdateFeedSubscriberInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFeedSubscriberInputFiltersDto)
  @IsOptional()
  filters?: UpdateFeedSubscriberInputFiltersDto[];
}
