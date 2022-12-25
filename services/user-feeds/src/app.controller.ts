import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller({
  version: "1",
  path: "user-feeds",
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  getHello(): string {
    return this.appService.getHello();
  }
}
