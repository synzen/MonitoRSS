import { Module } from "@nestjs/common";
import { DeliveryRecordService } from "./delivery-record.service";

@Module({
  providers: [DeliveryRecordService],
  exports: [DeliveryRecordService],
})
export class DeliveryRecordModule {}
