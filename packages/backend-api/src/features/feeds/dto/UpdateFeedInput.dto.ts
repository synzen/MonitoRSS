import { IsOptional, IsString } from 'class-validator';

export class UpdateFeedInputDto {
  @IsString()
  @IsOptional()
  text?: string;
}
