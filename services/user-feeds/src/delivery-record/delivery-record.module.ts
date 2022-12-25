import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { DeliveryRecordService } from "./delivery-record.service";
import { DeliveryRecord } from "./entities";

@Module({
  providers: [DeliveryRecordService],
  exports: [DeliveryRecordService],
  imports: [MikroOrmModule.forFeature([DeliveryRecord])],
})
export class DeliveryRecordModule {}
