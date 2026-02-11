import { DiscordPresenceStatus } from "./constants/discord-presence-status.constants";
import { DiscordPresenceActivityType } from "./constants/discord-presence-activity-type.constants";

export interface AppConfig {
  botToken: string;
  botClientId?: string;
  supporterGuildId?: string;
  rabbitMqUrl: string;
  presenceStatus: {
    status: DiscordPresenceStatus;
    activity?: {
      name: string;
      type: DiscordPresenceActivityType;
      url?: string;
    };
  } | null;
}

export function loadConfig(): AppConfig {
  const botToken = process.env.BOT_PRESENCE_DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      "Config validation failed\nBOT_PRESENCE_DISCORD_BOT_TOKEN is required",
    );
  }

  const rabbitMqUrlRaw = process.env.BOT_PRESENCE_RABBITMQ_URL;

  if (!rabbitMqUrlRaw) {
    throw new Error(
      "Config validation failed\nBOT_PRESENCE_RABBITMQ_URL is required",
    );
  }

  const statusRaw = process.env.BOT_PRESENCE_STATUS;
  const activityTypeRaw = process.env.BOT_PRESENCE_ACTIVITY_TYPE;
  const validStatuses = Object.values(DiscordPresenceStatus) as string[];
  const validActivityTypes = Object.values(
    DiscordPresenceActivityType,
  ) as string[];

  if (statusRaw && !validStatuses.includes(statusRaw)) {
    throw new Error(
      `Config validation failed\nBOT_PRESENCE_STATUS must be one of: ${validStatuses.join(
        ", ",
      )}`,
    );
  }

  if (activityTypeRaw && !validActivityTypes.includes(activityTypeRaw)) {
    throw new Error(
      `Config validation failed\nBOT_PRESENCE_ACTIVITY_TYPE must be one of: ${validActivityTypes.join(
        ", ",
      )}`,
    );
  }

  const status = statusRaw as DiscordPresenceStatus | undefined;
  const activityType = activityTypeRaw as
    | DiscordPresenceActivityType
    | undefined;
  const activityName = process.env.BOT_PRESENCE_ACTIVITY_NAME;
  const activityStreamUrl = process.env.BOT_PRESENCE_ACTIVITY_STREAM_URL;

  let presenceStatus: AppConfig["presenceStatus"] = null;

  if (status) {
    presenceStatus = {
      status,
      activity:
        activityName && activityType
          ? {
              name: activityName,
              type: activityType,
              url: activityStreamUrl,
            }
          : undefined,
    };
  }

  return {
    botToken,
    botClientId: process.env.BOT_PRESENCE_DISCORD_BOT_CLIENT_ID,
    supporterGuildId: process.env.BOT_PRESENCE_SUPPORTER_GUILD_ID,
    rabbitMqUrl: encodeURI(rabbitMqUrlRaw),
    presenceStatus,
  };
}
