import { IsIn } from "class-validator";
import { UserFeedManagerStatus } from "../constants";

export class UpdateUserFeedManagementInviteStatusInputDto {
  @IsIn([UserFeedManagerStatus.Accepted, UserFeedManagerStatus.Declined])
  status: Extract<
    UserFeedManagerStatus,
    UserFeedManagerStatus.Accepted | UserFeedManagerStatus.Declined
  >;
}
