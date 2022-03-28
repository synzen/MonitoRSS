import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { FeedSubscriberType } from '../entities/feed-subscriber.entity';

export class CreateFeedSubscriberInputDto {
  @IsEnum(FeedSubscriberType)
  type: FeedSubscriberType;

  @IsString()
  @IsNotEmpty()
  discordId: string;
}
