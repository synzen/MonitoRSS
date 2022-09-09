import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Module({
  controllers: [],
  providers: [DeliveryService, DiscordMediumService],
})
export class DeliveryModule {}
