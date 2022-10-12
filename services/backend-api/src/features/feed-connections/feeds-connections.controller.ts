import { Controller, UseGuards } from "@nestjs/common";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { FeedsService } from "../feeds/feeds.service";

@Controller("feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedsConnectionsController {
  constructor(private readonly feedsService: FeedsService) {}
}
