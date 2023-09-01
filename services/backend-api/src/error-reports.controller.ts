import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { DiscordOAuth2Guard } from "./features/discord-auth/guards/DiscordOAuth2.guard";
import logger from "./utils/logger";

@Controller("error-reports")
@UseGuards(DiscordOAuth2Guard)
export class ErrorReportsController {
  @Post()
  createErrorReport(@Body() body: Record<string, unknown>) {
    logger.error(`Error report`, {
      body,
    });

    return {
      ok: 1,
    };
  }
}
