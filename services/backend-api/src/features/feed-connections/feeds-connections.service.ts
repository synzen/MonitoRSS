import { HttpStatus, Injectable } from "@nestjs/common";
import { DiscordGuildChannel } from "../../common";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import logger from "../../utils/logger";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";

@Injectable()
export class FeedsConnectionsService {
  constructor(private readonly discordApiService: DiscordAPIService) {}

  async createDiscordChannelConnection({
    channelId,
  }: {
    name: string;
    channelId: string;
  }) {
    let channel: DiscordGuildChannel;

    try {
      channel = await this.discordApiService.getChannel(channelId);
    } catch (err) {
      logger.info(`Error while getting channel ${channelId} of feed addition`, {
        stack: err.stack,
      });

      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new DiscordChannelPermissionsException();
        }
      }

      throw err;
    }
  }
}
