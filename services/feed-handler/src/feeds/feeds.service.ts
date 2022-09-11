import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Feed, FeedDocument } from "./schemas/feed.entity";

@Injectable()
export class FeedsService {
  constructor(@InjectModel(Feed.name) private feedModel: Model<FeedDocument>) {}
}
