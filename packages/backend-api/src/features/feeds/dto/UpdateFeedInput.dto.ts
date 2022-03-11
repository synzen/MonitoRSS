import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class UpdateFeedInputFiltersDto {
  @IsString()
  category: string;

  @IsString()
  value: string;
}

export class UpdateFeedInputDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  webhookId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFeedInputDto)
  @IsOptional()
  filters?: UpdateFeedInputFiltersDto[];
}
