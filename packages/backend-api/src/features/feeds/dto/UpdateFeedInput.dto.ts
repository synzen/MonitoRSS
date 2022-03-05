import { IsOptional, IsString } from 'class-validator';

export class UpdateFeedInputDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  webhookId?: string;
}
