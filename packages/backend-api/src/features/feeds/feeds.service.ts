import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/Feed.entity';

@Injectable()
export class FeedsService {
  constructor(@InjectModel(Feed.name) private readonly feedModel: FeedModel) {}
}
