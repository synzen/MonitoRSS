import { Injectable, NotFoundException, PipeTransform } from "@nestjs/common";
import { Types } from "mongoose";
import { UserFeedsService } from "../user-feeds.service";

@Injectable()
export class GetUserFeedPipe implements PipeTransform {
  constructor(private readonly userFeedsService: UserFeedsService) {}

  async transform(feedId: string) {
    if (!Types.ObjectId.isValid(feedId)) {
      throw new NotFoundException("Feed not found");
    }

    const found = await this.userFeedsService.getFeedById(feedId);

    if (!found) {
      throw new NotFoundException(`Feed ${feedId} not found`);
    }

    return found;
  }
}
