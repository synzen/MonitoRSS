import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class UpdateFeedInputFiltersDto {
  @IsString()
  category: string;

  @IsString()
  value: string;
}

export class UpdateFeedInputDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  webhookId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFeedInputFiltersDto)
  @IsOptional()
  filters?: UpdateFeedInputFiltersDto[];
}
