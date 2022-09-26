import { IsMongoId } from "class-validator";

export class DeleteFeedSubscriberInputDto {
  @IsMongoId()
  feedId: string;

  @IsMongoId()
  subscriberId: string;
}
