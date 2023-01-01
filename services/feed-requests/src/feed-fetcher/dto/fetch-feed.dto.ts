import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class FetchFeedDto {
  @IsUrl()
  url!: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetch?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetchIfNotExists?: boolean;
}
