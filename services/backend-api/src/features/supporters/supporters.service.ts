import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Supporter, SupporterModel } from "./entities/supporter.entity";
import dayjs from "dayjs";
import { Patron } from "./entities/patron.entity";
import { ConfigService } from "@nestjs/config";
import { PipelineStage } from "mongoose";
import { PatronsService } from "./patrons.service";
import { GuildSubscriptionsService } from "./guild-subscriptions.service";
import { GuildSubscriptionFormatted } from "./types";

interface SupporterBenefits {
  isSupporter: boolean;
  maxFeeds: number;
  guilds: string[];
  maxGuilds: number;
  expireAt?: Date;
  refreshRateSeconds: number;
}

interface ServerBenefits {
  hasSupporter: boolean;
  maxFeeds: number;
  serverId: string;
  webhooks: boolean;
  refreshRateSeconds?: number;
}

interface SupportPatronAggregateResult {
  maxFeeds?: number;
  maxGuilds?: number;
  slowRate?: boolean;
  patrons: Array<{
    status: Patron["status"];
    pledge: number;
    pledgeLifetime: number;
    pledgeOverride?: number;
  }>;
}

@Injectable()
export class SupportersService {
  defaultMaxFeeds: number;
  defaultRefreshRateSeconds: number;

  constructor(
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    private readonly configService: ConfigService,
    private readonly patronsService: PatronsService,
    private readonly guildSubscriptionsService: GuildSubscriptionsService
  ) {
    // Conversions should be done at the config level, but this is just a hack for now
    this.defaultMaxFeeds = Number(
      this.configService.getOrThrow<number>("DEFAULT_MAX_FEEDS") as number
    );
    this.defaultRefreshRateSeconds =
      this.configService.getOrThrow<number>("DEFAULT_REFRESH_RATE_MINUTES") *
      60;
  }

  static SUPPORTER_PATRON_PIPELINE: PipelineStage[] = [
    {
      $lookup: {
        from: "patrons",
        localField: "_id",
        foreignField: "discord",
        as: "patrons",
      },
    },
  ];

  async getBenefitsOfDiscordUser(
    discordId: string
  ): Promise<SupporterBenefits> {
    const aggregate: Array<
      Supporter & {
        patrons: Patron[];
      }
    > = await this.supporterModel.aggregate([
      {
        $match: {
          _id: discordId,
        },
      },
      ...SupportersService.SUPPORTER_PATRON_PIPELINE,
    ]);

    if (!aggregate.length) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        guilds: [],
        maxGuilds: 0,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
      };
    }

    const benefits = await this.getBenefitsFromSupporter(aggregate[0]);

    return {
      isSupporter: benefits.isSupporter,
      maxFeeds: benefits.maxFeeds,
      guilds: aggregate[0].guilds,
      maxGuilds: benefits.maxGuilds,
      expireAt: aggregate[0].expireAt,
      refreshRateSeconds: benefits.refreshRateSeconds,
    };
  }

  async getBenefitsOfAllServers() {
    const subscriptions =
      await this.guildSubscriptionsService.getAllSubscriptions();

    const subscriptionsByGuildId = new Map<string, GuildSubscriptionFormatted>(
      subscriptions.map((sub) => [sub.guildId, sub])
    );

    const allSupportersWithGuild: Array<
      Omit<Supporter, "guilds"> & {
        patrons: Patron[];
        guilds: string; // Unwinded to actually be guild IDs
        guildId: string; // An alias to unwinded "guilds" for readability
      }
    > = await this.supporterModel.aggregate([
      ...SupportersService.SUPPORTER_PATRON_PIPELINE,
    ]);

    const benefitsMappedBySeverIds = new Map<
      string,
      ReturnType<typeof this.getBenefitsFromSupporter>[]
    >();

    for (const supporter of allSupportersWithGuild) {
      const { guildId } = supporter;
      const benefits = this.getBenefitsFromSupporter(supporter);
      const benefitsSoFar = benefitsMappedBySeverIds.get(guildId);

      if (!benefitsSoFar) {
        benefitsMappedBySeverIds.set(guildId, [benefits]);
      } else {
        benefitsSoFar.push(benefits);
      }
    }

    const serverIds = allSupportersWithGuild.map(
      (supporter) => supporter.guildId
    );

    return serverIds.map((serverId) => {
      const subscription = subscriptionsByGuildId.get(serverId);
      const serverBenefits = benefitsMappedBySeverIds.get(serverId);

      return this.calculateBenefitsOfServer(serverId, {
        subscription,
        supporterBenefits: serverBenefits,
      });
    });
  }

  async getBenefitsOfServers(serverIds: string[]): Promise<ServerBenefits[]> {
    const subscriptions =
      await this.guildSubscriptionsService.getAllSubscriptions({
        filters: {
          serverIds,
        },
      });

    const allSupportersWithGuild: Array<
      Omit<Supporter, "guilds"> & {
        patrons: Patron[];
        guilds: string; // Unwinded to actually be guild IDs
        guildId: string; // An alias to unwinded "guilds" for readability
      }
    > = await this.supporterModel.aggregate([
      {
        $match: {
          guilds: {
            $in: serverIds,
          },
        },
      },
      ...SupportersService.SUPPORTER_PATRON_PIPELINE,
      {
        $unwind: "$guilds",
      },
      {
        $match: {
          guilds: {
            $in: serverIds,
          },
        },
      },
      {
        $addFields: {
          guildId: "$guilds",
        },
      },
    ]);

    const benefitsMappedBySeverIds = new Map<
      string,
      ReturnType<typeof this.getBenefitsFromSupporter>[]
    >();

    for (const supporter of allSupportersWithGuild) {
      const { guildId } = supporter;
      const benefits = this.getBenefitsFromSupporter(supporter);
      const benefitsSoFar = benefitsMappedBySeverIds.get(guildId);

      if (!benefitsSoFar) {
        benefitsMappedBySeverIds.set(guildId, [benefits]);
      } else {
        benefitsSoFar.push(benefits);
      }
    }

    return serverIds.map((serverId) => {
      const subscription = subscriptions.find(
        (sub) => sub.guildId === serverId
      );
      const serverBenefits = benefitsMappedBySeverIds.get(serverId);

      return this.calculateBenefitsOfServer(serverId, {
        subscription,
        supporterBenefits: serverBenefits,
      });
    });
  }

  private calculateBenefitsOfServer(
    serverId: string,
    {
      subscription,
      supporterBenefits: serverBenefits,
    }: {
      subscription?: GuildSubscriptionFormatted;
      supporterBenefits?: ReturnType<typeof this.getBenefitsFromSupporter>[];
    }
  ) {
    if (subscription) {
      return {
        hasSupporter: true,
        maxFeeds: subscription.maxFeeds,
        refreshRateSeconds: subscription.refreshRate,
        serverId,
        webhooks: true,
      };
    }

    if (!serverBenefits?.length) {
      return {
        hasSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        serverId,
        webhooks: false,
      };
    }

    return {
      hasSupporter: serverBenefits.some((b) => b.isSupporter),
      maxFeeds: Math.max(...serverBenefits.map((b) => b.maxFeeds)),
      serverId,
      webhooks: serverBenefits.some((b) => b.webhooks),
      // Arbitrarily select one since there is no business rule on this at the moment
      refreshRateSeconds: serverBenefits.find(
        (b) => b.refreshRateSeconds !== undefined
      )?.refreshRateSeconds,
    };
  }

  async serverCanUseWebhooks(serverId: string) {
    const benefits = await this.getBenefitsOfServers([serverId]);

    return benefits[0]?.webhooks || false;
  }

  async setGuilds(userId: string, guildIds: string[]) {
    const updatedSupporter = await this.supporterModel
      .findOneAndUpdate(
        {
          _id: userId,
        },
        {
          $set: {
            guilds: guildIds,
          },
        },
        {
          new: true,
        }
      )
      .lean();

    if (!updatedSupporter) {
      throw new Error(
        `User ${userId} was not found while updating supporter guild ids`
      );
    }

    return updatedSupporter;
  }

  getBenefitsFromSupporter(supporter: SupportPatronAggregateResult) {
    if (!this.isValidSupporter(supporter)) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        maxGuilds: 0,
        webhooks: false,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
      };
    }

    const isFromPatrons = supporter.patrons.length > 0;

    const {
      maxFeeds: patronMaxFeeds,
      maxGuilds: patronMaxGuilds,
      refreshRateSeconds: patronRefreshRateSeconds,
    } = this.patronsService.getMaxBenefitsFromPatrons(supporter.patrons);

    let refreshRateSeconds: number;

    if (supporter.slowRate) {
      refreshRateSeconds = this.defaultRefreshRateSeconds;
    } else if (isFromPatrons) {
      refreshRateSeconds =
        patronRefreshRateSeconds || this.defaultRefreshRateSeconds;
    } else {
      refreshRateSeconds = 120;
    }

    return {
      isSupporter: true,
      maxFeeds: Math.max(
        supporter.maxFeeds ?? this.defaultMaxFeeds,
        patronMaxFeeds
      ),
      maxGuilds: Math.max(supporter.maxGuilds ?? 1, patronMaxGuilds),
      refreshRateSeconds,
      webhooks: true,
    };
  }

  isValidSupporter(
    supporter?: {
      expireAt?: Date;
    } & {
      patrons: {
        status: Patron["status"];
        pledge: number;
      }[];
    }
  ) {
    if (!supporter) {
      return false;
    }

    const { expireAt, patrons } = supporter;

    if (!expireAt) {
      if (!patrons.length) {
        return true;
      }

      return patrons.some((patron) =>
        this.patronsService.isValidPatron(patron)
      );
    }

    return dayjs(expireAt).isAfter(dayjs());
  }
}
