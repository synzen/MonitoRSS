import { IsUrl } from 'class-validator';

export class FetchFeedDto {
  @IsUrl()
  url!: string;
}
