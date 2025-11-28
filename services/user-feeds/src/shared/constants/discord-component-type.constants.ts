export enum DiscordComponentType {
  // Legacy components (numeric for backwards compatibility)
  ActionRow = 1,
  Button = 2,

  // V2 components (string enums for easier debugging)
  Section = "SECTION",
  TextDisplay = "TEXT_DISPLAY",
  Thumbnail = "THUMBNAIL",
  ActionRowV2 = "ACTION_ROW",
  ButtonV2 = "BUTTON",
}

// Mapping from string enum values to Discord API numeric values
export const DISCORD_COMPONENT_TYPE_TO_NUMBER: Record<string, number> = {
  [DiscordComponentType.Section]: 9,
  [DiscordComponentType.TextDisplay]: 10,
  [DiscordComponentType.Thumbnail]: 11,
  [DiscordComponentType.ActionRowV2]: 1,
  [DiscordComponentType.ButtonV2]: 2,
};
