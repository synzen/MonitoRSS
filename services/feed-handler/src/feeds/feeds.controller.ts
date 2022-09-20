import { Controller, Get, Param } from "@nestjs/common";
import { FeedsService } from "./feeds.service";

@Controller("feeds")
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return "";
  }
}
