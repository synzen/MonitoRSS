import { Module } from "@nestjs/common";
import { RedditLoginController } from "./reddit-login.controller";
import { UsersModule } from "../users/users.module";
import { RedditApiModule } from "../../services/apis/reddit/reddit-api.module";

@Module({
  controllers: [RedditLoginController],
  imports: [UsersModule, RedditApiModule],
})
export class RedditLoginModule {}
