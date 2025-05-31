import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { UserFeedTargetFeedSelectionType } from "../../user-feeds/constants/target-feed-selection-type.type";

export class CreateDiscordChannelConnectionCloneInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  targetFeedIds?: string[];

  @IsIn(Object.values(UserFeedTargetFeedSelectionType))
  @IsOptional()
  targetFeedSelectionType?: UserFeedTargetFeedSelectionType;

  @IsString()
  @IsOptional()
  targetFeedSearch?: string;
}
