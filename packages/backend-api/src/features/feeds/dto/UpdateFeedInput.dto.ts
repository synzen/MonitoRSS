import { IsString } from 'class-validator';

export class UpdateFeedInputDto {
  @IsString()
  text?: string;
}
