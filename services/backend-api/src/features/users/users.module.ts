import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SupporterSubscriptionsModule } from "../supporter-subscriptions/supporter-subscriptions.module";
import { SupportersModule } from "../supporters/supporters.module";
import { UserFeature } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule.forFeature([UserFeature])],
  imports: [MongooseModule.forFeature([UserFeature]), SupportersModule],
})
export class UsersModule {
  static forRoot(): DynamicModule {
    return {
      module: UsersModule,
      imports: [SupporterSubscriptionsModule.forRoot()],
    };
  }
}
