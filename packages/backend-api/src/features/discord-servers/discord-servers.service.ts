import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedModel } from '../feeds/entities/Feed.entity';

@Injectable()
export class DiscordServersService {
  constructor(@InjectModel(Feed.name) private readonly feedModel: FeedModel) {}
}
