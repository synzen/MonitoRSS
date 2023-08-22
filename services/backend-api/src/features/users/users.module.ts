import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserFeature } from "./entities/user.entity";
import { UsersService } from "./users.service";

@Module({
  providers: [UsersService],
  exports: [UsersService],
  imports: [MongooseModule.forFeature([UserFeature])],
})
export class UsersModule {
  static forRoot(): DynamicModule {
    return {
      module: UsersModule,
    };
  }
}
