import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SplitFactory } from '@splitsoftware/splitio';

@Injectable()
export class FeatureFlaggerService implements OnModuleInit, OnModuleDestroy {
  splitClient: SplitIO.IClient | null = null;

  constructor(private readonly configService: ConfigService) {
    const splitSdkKey = this.configService.get<string>('SPLIT_SDK_KEY');

    if (splitSdkKey) {
      const factory = SplitFactory({
        core: {
          authorizationKey: splitSdkKey,
        },
      });

      this.splitClient = factory.client();
    }
  }

  async onModuleDestroy() {
    await this.splitClient?.destroy();
  }

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const splitSdkKey = this.configService.get<string>(
      'FEED_REQUESTS_SPLIT_SDK_KEY',
    );

    if (splitSdkKey) {
      const factory = SplitFactory({
        core: {
          authorizationKey: splitSdkKey,
        },
      });

      this.splitClient = factory.client();

      await this.splitClient.ready().catch((e) => {
        throw e;
      });
    }
  }

  evaluateFeedUrl(
    featureName: string,
    feedUrl: string,
    defaultEvaluation: string,
  ): string {
    if (!this.splitClient) {
      return defaultEvaluation;
    }

    return this.splitClient.getTreatment(feedUrl, featureName);
  }
}
