import { IsArray, IsEnum, IsNotEmpty, IsString } from "class-validator";

export enum CopyableSetting {
  Embeds = "embeds",
  WebhookName = "webhookName",
  WebhookIconUrl = "webhookIconUrl",
  WebhookThread = "webhookThread",
  PlaceholderLimits = "placeholderLimits",
  Content = "content",
  ContentFormatTables = "contentFormatTables",
  ContentStripImages = "contentStripImages",
  IgnoreNewLines = "ignoreNewLines",
  ContentDisableImageLinkPreviews = "contentDisableImageLinkPreviews",
  Components = "components",
  ComponentsV2 = "componentsV2",
  ForumThreadTitle = "forumThreadTitle",
  ForumThreadTags = "forumThreadTags",
  placeholderFallbackSetting = "placeholderFallbackSetting",
  Filters = "filters",
  SplitOptions = "splitOptions",
  CustomPlaceholders = "customPlaceholders",
  DeliveryRateLimits = "deliveryRateLimits",
  MessageMentions = "messageMentions",
  Channel = "channel",
}

export class CreateDiscordChannelConnectionCopyConnectionSettingsInputDto {
  @IsNotEmpty()
  @IsEnum(CopyableSetting, { each: true })
  @IsArray()
  properties: CopyableSetting[];

  @IsArray()
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  targetDiscordChannelConnectionIds: string[];
}
