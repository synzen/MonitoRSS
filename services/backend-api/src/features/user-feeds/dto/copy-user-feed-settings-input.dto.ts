import { IsArray, IsEnum, IsString } from "class-validator";

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
  targetFeedIds: string[];

  @IsArray()
  @IsEnum(UserFeedCopyableSetting, { each: true })
  settings: UserFeedCopyableSetting[];
}
