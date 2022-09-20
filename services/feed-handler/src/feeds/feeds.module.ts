import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { FeedsController } from "./feeds.controller";
import { DeliveryRecordModule } from "../delivery-record/delivery-record.module";

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [DeliveryRecordModule],
})
export class FeedsModule {}
