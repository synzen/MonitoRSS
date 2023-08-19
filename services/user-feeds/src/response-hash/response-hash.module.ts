import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ResponseHash } from "./entities/response-hash.entity";
import { ResponseHashService } from "./response-hash.service";

@Module({
  imports: [MikroOrmModule.forFeature([ResponseHash])],
  controllers: [],
  providers: [ResponseHashService],
  exports: [ResponseHashService],
})
export class ResponseHashModule {}
