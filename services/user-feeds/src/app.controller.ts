import { Controller, Get } from "@nestjs/common";

@Controller({
  version: "1",
  path: "user-feeds",
})
export class AppController {
  @Get("health")
  getHello(): string {
    return "Hello world";
  }
}
