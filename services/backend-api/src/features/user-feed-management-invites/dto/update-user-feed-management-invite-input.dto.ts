import { IsIn } from "class-validator";
import { UserFeedManagerStatus } from "../constants";

export class UpdateUserFeedManagementInviteInputDto {
  @IsIn([UserFeedManagerStatus.Accepted, UserFeedManagerStatus.Declined])
  status: Extract<
    UserFeedManagerStatus,
    UserFeedManagerStatus.Accepted | UserFeedManagerStatus.Declined
  >;
}
