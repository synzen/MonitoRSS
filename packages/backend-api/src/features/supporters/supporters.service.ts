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

  async getBenefitsOfServers(serverIds: string[]) {
    const aggregate: Array<{ maxFeeds: number; guilds: string[] }> =
      await this.supporterModel.aggregate([
        {
          $match: {
            guilds: {
              $in: serverIds,
            },
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
            guilds: 1,
          },
        },
      ]);

    const maxFeedsCounter = new Map<string, number>();

    const defaultMaxFeeds = this.configService.get<number>(
      'defaultMaxFeeds',
    ) as number;

    if (defaultMaxFeeds == null) {
      throw new Error('defaultMaxFeeds is not set');
    }

    serverIds.forEach((serverId) => {
      maxFeedsCounter.set(serverId, defaultMaxFeeds);

      aggregate.forEach((aggregateResult) => {
        const currentMaxFeeds = maxFeedsCounter.get(serverId) as number;

        if (aggregateResult.guilds.includes(serverId)) {
          maxFeedsCounter.set(
            serverId,
            Math.max(aggregateResult.maxFeeds, currentMaxFeeds),
          );
        }
      });
    });

    return serverIds.map((serverId) => ({
      maxFeeds: maxFeedsCounter.get(serverId) as number,
      serverId,
      webhooks: aggregate.some((aggregateResult) =>
        aggregateResult.guilds.includes(serverId),
      ),
    }));
  }

  async serverCanUseWebhooks(serverId: string) {
    const benefits = await this.getBenefitsOfServers([serverId]);

    return benefits[0]?.webhooks || false;
  }
}
