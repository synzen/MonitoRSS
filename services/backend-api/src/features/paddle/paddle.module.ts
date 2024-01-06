import { Module } from "@nestjs/common";
import { PaddleService } from "./paddle.service";

@Module({
  imports: [],
  controllers: [],
  providers: [PaddleService],
  exports: [PaddleService],
})
export class PaddleModule {}
