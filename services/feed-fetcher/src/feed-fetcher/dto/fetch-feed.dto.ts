import { IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class FetchFeedDto {
  @IsUrl()
  url!: string;

  @IsBoolean()
  @IsOptional()
  executeFetch?: boolean;
}
