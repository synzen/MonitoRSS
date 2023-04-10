import { CreateDiscordChannelPreviewInput } from "./create-discord-channel-preview-input.type";
import { CreateDiscordWebhookPreviewInput } from "./create-discord-webhook-preview-input.type";

export type CreatePreviewInput =
  | CreateDiscordChannelPreviewInput
  | CreateDiscordWebhookPreviewInput;
