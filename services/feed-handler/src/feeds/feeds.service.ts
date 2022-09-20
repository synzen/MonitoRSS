import { Injectable } from "@nestjs/common";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";

@Injectable()
export class FeedsService {
  constructor(private readonly deliveryRecordService: DeliveryRecordService) {}
}
