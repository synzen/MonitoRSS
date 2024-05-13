import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
} from "@nestjs/common";
import { AppService } from "./app.service";
import { FastifyRequest } from "fastify";
import { ConfigService } from "@nestjs/config";
import logger from "./utils/logger";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService
  ) {}

  @Post("sentry-tunnel")
  async sentryTunnel(@Req() req: FastifyRequest) {
    try {
      const sentryHost = this.configService.get<string>(
        "BACKEND_API_SENTRY_HOST"
      );
      const projectIds = this.configService.get<string[]>(
        "BACKEND_API_SENTRY_PROJECT_IDS"
      );

      if (!sentryHost || !projectIds?.length) {
        return {
          ok: 1,
        };
      }

      const envelope = req.body as Buffer;
      const pieces = envelope.toString().split("\n");
      const header = JSON.parse(pieces[0]);
      const { hostname, pathname } = new URL(header.dsn);
      const projectId = pathname.replace("/", "");

      if (hostname !== sentryHost) {
        throw new Error(`Invalid sentry hostname: ${hostname}`);
      }

      if (!projectId || !projectIds.includes(projectId)) {
        throw new Error(`Invalid sentry project id: ${projectId}`);
      }

      const url = `https://${hostname}/api/${projectId}/envelope/`;

      const res = await fetch(url, {
        method: "POST",
        body: envelope,
      });

      if (!res.ok) {
        let bodyText: string | null = null;

        try {
          bodyText = await res.text();
        } catch (e) {}

        logger.error(`Failed to send envelope to sentry: ${res.status}`, {
          body: bodyText,
        });
      }

      return {
        ok: 1,
      };
    } catch (e) {
      const error = e?.response || e?.message;
      throw new BadRequestException(error);
    }
  }

  @Get("health")
  getHello() {
    return {
      ok: 1,
    };
  }
}
