import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Supporter, SupporterModel } from './entities/supporter.entity';
import dayjs from 'dayjs';
import { PatronStatus } from './entities/patron.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupportersService {
  constructor(
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    private readonly configService: ConfigService,
  ) {}

  async getBenefitsOfServer(serverId: string) {
    const aggregate: Array<{ maxFeeds: number }> =
      await this.supporterModel.aggregate([
        {
          $match: {
            guilds: serverId,
          },
        },
        {
          $lookup: {
            from: 'patrons',
            localField: '_id',
            foreignField: 'discord',
            as: 'patron',
          },
        },
        {
          $match: {
            $or: [
              // No patron
              {
                expireAt: {
                  $exists: false,
                },
                'patron.0': {
                  $exists: false,
                },
              },
              {
                expireAt: {
                  $exists: true,
                  $gte: dayjs().toDate(),
                },
              },
              // Has patron
              {
                'patron.0.status': PatronStatus.ACTIVE,
                'patron.0.pledge': {
                  $gt: 0,
                },
              },
              {
                'patron.0.status': PatronStatus.DECLINED,
                'patron.0.lastCharge': {
                  $exists: true,
                  $gt: dayjs().subtract(4, 'days').toDate(),
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            maxFeeds: 1,
          },
        },
      ]);

    const defaultMaxFeeds = this.configService.get<number>(
      'defaultMaxFeeds',
    ) as number;

    const highestMaxFeeds = aggregate.reduce(
      (acc, curr) => Math.max(acc, curr.maxFeeds),
      // hardcoded for now
      defaultMaxFeeds,
    );

    console.log(aggregate);

    return {
      maxFeeds: highestMaxFeeds,
      webhook: true,
    };
  }
}
