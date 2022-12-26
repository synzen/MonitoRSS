import { SendTestDiscordChannelArticleInput } from "./send-test-discord-channel-article-input.type";
import { SendTestDiscordWebhookArticleInput } from "./send-test-discord-webhook-article-input.type";

export type SendTestArticleInput =
  | SendTestDiscordChannelArticleInput
  | SendTestDiscordWebhookArticleInput;
