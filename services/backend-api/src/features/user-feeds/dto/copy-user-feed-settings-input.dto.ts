import { IsArray, IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { UserFeedTargetFeedSelectionType } from "../constants/target-feed-selection-type.type";

export enum UserFeedCopyableSetting {
  Connections = "connections",
  PassingComparisons = "passingComparisons",
  BlockingComparisons = "blockingComparisons",
  ExternalProperties = "externalProperties",
  RefreshRate = "refreshRate",
  DateChecks = "dateChecks",
  DatePlaceholderSettings = "datePlaceholderSettings",
}

export class CopyUserFeedSettingsInputDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetFeedIds: string[];

  @IsArray()
  @IsEnum(UserFeedCopyableSetting, { each: true })
  settings: UserFeedCopyableSetting[];

  @IsIn(Object.values(UserFeedTargetFeedSelectionType))
  @IsOptional()
  targetFeedSelectionType?: UserFeedTargetFeedSelectionType;

  @IsString()
  @IsOptional()
  targetFeedSearch?: string;
}
